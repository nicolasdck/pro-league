import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchLiveMatchState } from '../src/lib/footmercatoScraper.js';
import { isWithinLiveWindow } from '../src/lib/liveWindow.js';
import { isGoal, sendGoalNotifications, type CompetitionKey } from '../src/lib/goalNotify.js';
import type { FixtureStatus } from '../src/types/index.js';

// Two ways to call this:
//   ?table=cup_fixtures&urls=<url1,url2>  — targeted (the browser already
//     knows which of its loaded fixtures are live, see
//     src/hooks/useLiveScorePollingEuro.ts — cheaper, no extra Supabase read).
//   (no params)                           — self-discovery: queries both
//     tables itself for whatever is currently in its live window. Meant for
//     an unattended periodic caller (e.g. a phone running a background sync
//     app, or a free external scheduler) that keeps scores fresh even when
//     no one has the web app open — see android-sync/ in this repo.
// Never a Vercel cron either way — Hobby refuses anything more frequent
// than once a day.
//
// `table` is interpolated into a Supabase `.from()` call running under the
// service-role key (bypasses RLS), so it MUST be validated against a fixed
// allowlist — never pass the query param through unchecked.
const ALLOWED_TABLES = ['cup_fixtures', 'european_fixtures'] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

// Matches are targeted by `match_url`, not `id`: PostgREST serializes
// cup_fixtures/european_fixtures' bigint `id` as a bare JSON number, which
// silently loses precision in JS past 2^53 (footmercato's ids routinely
// exceed that — confirmed while building this). `match_url` is plain text
// with no such risk, and doubles as origin-checking: only URLs that already
// exist verbatim in our own table are ever fetched, so there's no way to
// turn this into an open scrape-any-URL proxy.
const MAX_URLS_PER_TABLE = 6;

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function discoverLiveMatchUrls(supabase: SupabaseClient, table: AllowedTable): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select('match_url, status, event_date')
    .neq('status', 'FT')
    .not('match_url', 'is', null);
  if (error) throw error;

  const now = Date.now();
  return (data ?? [])
    .filter((row) => isWithinLiveWindow(row.status as FixtureStatus, row.event_date as string | null, now))
    .map((row) => row.match_url as string)
    .slice(0, MAX_URLS_PER_TABLE);
}

interface FixtureBeforeRow {
  match_url: string;
  home_score: number | null;
  away_score: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string;
  away_team_name: string;
  competition?: string; // only selected for european_fixtures
}

function competitionKeyFor(table: AllowedTable, row: FixtureBeforeRow): CompetitionKey {
  if (table === 'cup_fixtures') return 'cup';
  if (row.competition === 'CL') return 'cl';
  if (row.competition === 'ECL') return 'ecl';
  return 'el';
}

async function refreshMatches(
  supabase: SupabaseClient,
  table: AllowedTable,
  urls: string[],
): Promise<Array<{ matchUrl: string; status: string; homeScore: number | null; awayScore: number | null }>> {
  if (urls.length === 0) return [];

  // Read before writing: this is the only way to know a goal *just*
  // happened (vs. the score already being what it is) — see isGoal().
  const select =
    table === 'cup_fixtures'
      ? 'match_url, home_score, away_score, home_team_id, away_team_id, home_team_name, away_team_name'
      : 'match_url, home_score, away_score, home_team_id, away_team_id, home_team_name, away_team_name, competition';
  const { data: rows, error: fetchError } = await supabase.from(table).select(select).in('match_url', urls);
  if (fetchError) throw fetchError;

  const updated: Array<{ matchUrl: string; status: string; homeScore: number | null; awayScore: number | null }> = [];

  for (const row of (rows ?? []) as unknown as FixtureBeforeRow[]) {
    const state = await fetchLiveMatchState(row.match_url);
    if (!state) continue;

    // Live status is a generic '1H' marker, not a literal first-half
    // claim — see the FixtureStatus comment in src/types/index.ts.
    const status = state.isFinished ? 'FT' : '1H';
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status,
        home_score: state.homeScore,
        away_score: state.awayScore,
        updated_at: new Date().toISOString(),
      })
      .eq('match_url', row.match_url);
    if (updateError) throw updateError;

    updated.push({ matchUrl: row.match_url, status, homeScore: state.homeScore, awayScore: state.awayScore });

    if (
      state.homeScore !== null &&
      state.awayScore !== null &&
      isGoal({ homeScore: row.home_score, awayScore: row.away_score }, { homeScore: state.homeScore, awayScore: state.awayScore })
    ) {
      sendGoalNotifications(supabase, {
        competitionKey: competitionKeyFor(table, row),
        homeTeamId: row.home_team_id,
        awayTeamId: row.away_team_id,
        homeName: row.home_team_name,
        awayName: row.away_team_name,
        homeScore: state.homeScore,
        awayScore: state.awayScore,
        // A notification failure must never break score syncing.
      }).catch(() => undefined);
    }
  }

  return updated;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const table = req.query.table;
  const urlsParam = req.query.urls;

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
    return;
  }

  try {
    if (urlsParam !== undefined || table !== undefined) {
      // Targeted mode.
      if (typeof table !== 'string' || !ALLOWED_TABLES.includes(table as AllowedTable)) {
        res.status(400).json({ success: false, error: 'Invalid or missing table' });
        return;
      }
      if (typeof urlsParam !== 'string' || !urlsParam) {
        res.status(400).json({ success: false, error: 'Missing urls' });
        return;
      }
      const urls = urlsParam
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean)
        .slice(0, MAX_URLS_PER_TABLE);
      if (urls.length === 0) {
        res.status(400).json({ success: false, error: 'No valid urls' });
        return;
      }

      const updated = await refreshMatches(supabase, table as AllowedTable, urls);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, updated });
      return;
    }

    // Self-discovery mode: check every table for whatever's live right now.
    const cupUrls = await discoverLiveMatchUrls(supabase, 'cup_fixtures');
    const europeanUrls = await discoverLiveMatchUrls(supabase, 'european_fixtures');
    const [cupUpdated, europeanUpdated] = await Promise.all([
      refreshMatches(supabase, 'cup_fixtures', cupUrls),
      refreshMatches(supabase, 'european_fixtures', europeanUrls),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, updated: [...cupUpdated, ...europeanUpdated] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ success: false, error: message });
  }
}

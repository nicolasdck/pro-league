import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { currentSeason } from '../src/lib/season.js';
import { D1_CLUB_ALIASES } from '../src/lib/d1ClubAliases.js';
import { discoverPhaseLinks, fetchHtml, parseMatchesFromHtml, sleep, REQUEST_DELAY_MS } from '../src/lib/footmercatoScraper.js';

// Replaces TheSportsDB (see git history for the old api/sync.ts) as the D1
// results source: no quota, same footmercato.net scraping engine already
// used for the Cup and the three European competitions, and it can be
// checked far more often than once a day (see api/live-scores.ts) without
// worrying about a shared free-tier key getting Cloudflare-banned.
//
// Every D1 match is between two of the 18 known clubs (unlike the Cup/
// Europe, where the opponent is often outside `teams` entirely), so
// home_team_id/away_team_id are always resolved and there's no need to
// store a name/logo fallback the way cup_fixtures/european_fixtures do.
const BASE_URL = 'https://www.footmercato.net/belgique/division-1a/calendrier/';

interface RawParsedMatch {
  homeTeamId: number;
  awayTeamId: number;
  eventDate: string;
  status: 'NS' | 'FT';
  homeScore: number | null;
  awayScore: number | null;
  round: string;
  matchUrl: string | null;
}

function labelForPhaseSlug(slug: string): string {
  const journeeMatch = slug.match(/^journee-(\d+)$/);
  if (journeeMatch) return `Journée ${journeeMatch[1]}`;
  return slug; // playoff phases (e.g. "phase-champions-play-offs") once footmercato links them
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function logSync(supabase: SupabaseClient, requestsUsed: number, success: boolean, message?: string): Promise<void> {
  await supabase.from('sync_logs').insert({ resource: 'fixtures', requests_used: requestsUsed, success, message });
}

async function scrapeAllMatches(): Promise<{ matches: RawParsedMatch[]; requestsUsed: number }> {
  const phaseLinks = await discoverPhaseLinks(BASE_URL);
  let requestsUsed = 1; // the base calendar page fetched by discoverPhaseLinks
  const matches: RawParsedMatch[] = [];

  for (const link of phaseLinks) {
    const html = await fetchHtml(link.url);
    requestsUsed += 1;

    for (const match of parseMatchesFromHtml(html, link.url)) {
      const homeTeamId = D1_CLUB_ALIASES[match.homeName] ?? null;
      const awayTeamId = D1_CLUB_ALIASES[match.awayName] ?? null;
      // Every D1 match is between two of the 18 known clubs — an unresolved
      // name means the alias table is missing an entry, not a real "skip".
      if (homeTeamId === null || awayTeamId === null || !match.eventDate) continue;

      matches.push({
        homeTeamId,
        awayTeamId,
        eventDate: match.eventDate,
        status: match.isPlayed ? 'FT' : 'NS',
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        round: labelForPhaseSlug(link.slug),
        matchUrl: match.matchUrl,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { matches, requestsUsed };
}

// Reconciles against `fixtures` rows already synced from the old
// TheSportsDB source (small `id`, `match_url` still null) so this doesn't
// create duplicate rows for matches that already exist — matched by
// (home team, away team, calendar day), since footmercato only carries a
// day-granularity date for already-finished matches (no kickoff time once
// a match is over) while TheSportsDB's stored event_date has the exact
// kickoff instant. Once a row has a match_url (this sync has touched it
// before), it's matched by match_url on subsequent runs instead.
async function fetchLegacyRowsByKey(supabase: SupabaseClient, season: number): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('fixtures')
    .select('id, home_team_id, away_team_id, event_date')
    .eq('season', season)
    .is('match_url', null);
  if (error) throw error;

  const byKey = new Map<string, number>();
  for (const row of data ?? []) {
    const dayKey = (row.event_date as string).slice(0, 10);
    byKey.set(`${row.home_team_id}_${row.away_team_id}_${dayKey}`, row.id as number);
  }
  return byKey;
}

async function syncD1Fixtures(supabase: SupabaseClient, season: number): Promise<{ requestsUsed: number; fixturesFound: number }> {
  const [{ matches, requestsUsed }, legacyByKey] = await Promise.all([
    scrapeAllMatches(),
    fetchLegacyRowsByKey(supabase, season),
  ]);

  const now = new Date().toISOString();
  interface NewFixtureRow {
    season: number;
    round: string;
    event_date: string;
    status: string;
    home_team_id: number;
    away_team_id: number;
    home_score: number | null;
    away_score: number | null;
    match_url: string | null;
    updated_at: string;
  }
  // Legacy rows keep their existing event_date (TheSportsDB's precise
  // kickoff instant) rather than footmercato's day-only fallback for
  // already-finished matches — everything else about the match still gets
  // refreshed, so this is a column patch, not a full-row upsert.
  interface LegacyFixturePatch {
    id: number;
    round: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    match_url: string | null;
    updated_at: string;
  }
  const legacyPatches: LegacyFixturePatch[] = [];
  const newRows: NewFixtureRow[] = [];

  for (const match of matches) {
    const dayKey = match.eventDate.slice(0, 10);
    const legacyId = legacyByKey.get(`${match.homeTeamId}_${match.awayTeamId}_${dayKey}`);

    if (legacyId !== undefined) {
      legacyPatches.push({
        id: legacyId,
        round: match.round,
        status: match.status,
        home_score: match.homeScore,
        away_score: match.awayScore,
        match_url: match.matchUrl,
        updated_at: now,
      });
    } else {
      newRows.push({
        season,
        round: match.round,
        event_date: match.eventDate,
        status: match.status,
        home_team_id: match.homeTeamId,
        away_team_id: match.awayTeamId,
        home_score: match.homeScore,
        away_score: match.awayScore,
        match_url: match.matchUrl,
        updated_at: now,
      });
    }
  }

  for (const { id, ...patch } of legacyPatches) {
    const { error } = await supabase.from('fixtures').update(patch).eq('id', id);
    if (error) throw error;
  }
  if (newRows.length > 0) {
    const { error } = await supabase.from('fixtures').upsert(newRows, { onConflict: 'match_url' });
    if (error) throw error;
  }

  return { requestsUsed, fixturesFound: matches.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = (req.query.secret as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
  if (cronSecret && providedSecret !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawSeason = req.query.season;
  const season = typeof rawSeason === 'string' && /^\d{4}$/.test(rawSeason) ? Number(rawSeason) : currentSeason();

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
    return;
  }

  try {
    const { requestsUsed, fixturesFound } = await syncD1Fixtures(supabase, season);
    await logSync(supabase, requestsUsed, true, `${fixturesFound} D1 fixture(s) found`);
    res.status(200).json({ success: true, season, requestsUsed, fixturesFound });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logSync(supabase, 0, false, message).catch(() => undefined);
    res.status(500).json({ success: false, error: message });
  }
}

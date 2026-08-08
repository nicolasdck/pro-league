import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetchLiveMatchState } from '../src/lib/footmercatoScraper.js';
import { isWithinLiveWindow } from '../src/lib/liveWindow.js';
import { isGoal, sendGoalNotifications } from '../src/lib/goalNotify.js';
import { currentSeason } from '../src/lib/season.js';
import type { FixtureStatus } from '../src/types/index.js';

// Client-triggered (see src/hooks/useLiveScorePolling.ts), never a cron —
// Vercel Hobby hard-blocks any cron more frequent than once a day, so real
// live updates can only come from the browser polling while a match is
// actually in its live window. Not gated by CRON_SECRET: unlike the daily
// sync endpoints, this one is meant to be called by any visitor's browser
// (or the Android background-sync app — see android-sync/README.md).
//
// Scrapes footmercato.net instead of calling TheSportsDB — see api/sync-d1.ts
// for why. Self-discovery only (no query params): queries `fixtures` itself
// for whatever's currently in its live window, the same pattern already used
// by api/live-scores-euro.ts.
const MAX_LIVE_MATCHES = 6;

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

interface FixtureCandidateRow {
  id: number;
  match_url: string;
  status: string;
  event_date: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
}

async function discoverLiveFixtures(supabase: SupabaseClient): Promise<FixtureCandidateRow[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select(
      'id, match_url, status, event_date, home_score, away_score, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)',
    )
    .eq('season', currentSeason())
    .neq('status', 'FT')
    .not('match_url', 'is', null);
  if (error) throw error;

  const now = Date.now();
  return ((data ?? []) as unknown as FixtureCandidateRow[])
    .filter((row) => isWithinLiveWindow(row.status as FixtureStatus, row.event_date, now))
    .slice(0, MAX_LIVE_MATCHES);
}

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
    return;
  }

  try {
    const candidates = await discoverLiveFixtures(supabase);
    const updated: Array<{ id: number; status: string; homeScore: number | null; awayScore: number | null }> = [];

    for (const fixture of candidates) {
      const state = await fetchLiveMatchState(fixture.match_url);
      if (!state) continue;

      // Live status is a generic '1H' marker, not a literal first-half
      // claim — see the FixtureStatus comment in src/types/index.ts.
      const status = state.isFinished ? 'FT' : '1H';
      const { error } = await supabase
        .from('fixtures')
        .update({ status, home_score: state.homeScore, away_score: state.awayScore, updated_at: new Date().toISOString() })
        .eq('id', fixture.id);
      if (error) throw error;
      updated.push({ id: fixture.id, status, homeScore: state.homeScore, awayScore: state.awayScore });

      if (
        state.homeScore !== null &&
        state.awayScore !== null &&
        isGoal({ homeScore: fixture.home_score, awayScore: fixture.away_score }, { homeScore: state.homeScore, awayScore: state.awayScore })
      ) {
        sendGoalNotifications(supabase, {
          competitionKey: 'league',
          homeTeamId: fixture.home_team_id,
          awayTeamId: fixture.away_team_id,
          homeName: fixture.home_team?.name ?? 'Domicile',
          awayName: fixture.away_team?.name ?? 'Extérieur',
          homeScore: state.homeScore,
          awayScore: state.awayScore,
          // A notification failure must never break score syncing.
        }).catch(() => undefined);
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ success: true, updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ success: false, error: message });
  }
}

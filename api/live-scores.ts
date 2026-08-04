import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isGoal, sendGoalNotifications } from '../src/lib/goalNotify.js';

// Client-triggered (see src/hooks/useLiveScorePolling.ts), never a cron —
// Vercel Hobby hard-blocks any cron more frequent than once a day, so real
// live updates can only come from the browser polling while a match is
// actually in its live window. Not gated by CRON_SECRET: unlike the daily
// sync endpoints, this one is meant to be called by any visitor's browser.
//
// TheSportsDB's free tier `livescore.php` genuinely does return live
// in-play status/scores (1H/HT/2H + running score) — contrary to the old
// assumption that this required a paid plan — but it's a single global feed
// across every sport/league with no server-side filter, so the Belgian Pro
// League's `idLeague` is filtered out of the full response here.
const BELGIAN_PRO_LEAGUE_ID = '4338';

interface LiveScoreEntry {
  idEvent: string;
  idLeague: string;
  strStatus: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function fetchBelgianLiveScores(): Promise<LiveScoreEntry[]> {
  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey) throw new Error('Missing THESPORTSDB_API_KEY environment variable');

  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${apiKey}/livescore.php`);
  if (!response.ok) {
    throw new Error(`TheSportsDB livescore request failed (${response.status})`);
  }
  const json = (await response.json()) as { livescore: LiveScoreEntry[] | null };
  return (json.livescore ?? []).filter((entry) => entry.idLeague === BELGIAN_PRO_LEAGUE_ID);
}

interface FixtureBeforeRow {
  home_score: number | null;
  away_score: number | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
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
    const liveEvents = await fetchBelgianLiveScores();
    const updated: Array<{ id: number; status: string; homeScore: number | null; awayScore: number | null }> = [];

    for (const event of liveEvents) {
      const homeScore = event.intHomeScore === null ? null : Number(event.intHomeScore);
      const awayScore = event.intAwayScore === null ? null : Number(event.intAwayScore);
      const id = Number(event.idEvent);

      // Read before writing: this is the only way to know a goal *just*
      // happened (vs. the score already being what it is) — see isGoal().
      const { data: before } = await supabase
        .from('fixtures')
        .select(
          'home_score, away_score, home_team_id, away_team_id, home_team:teams!fixtures_home_team_id_fkey(name), away_team:teams!fixtures_away_team_id_fkey(name)',
        )
        .eq('id', id)
        .maybeSingle();

      const { error } = await supabase
        .from('fixtures')
        .update({ status: event.strStatus, home_score: homeScore, away_score: awayScore, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      updated.push({ id, status: event.strStatus, homeScore, awayScore });

      const beforeRow = before as FixtureBeforeRow | null;
      if (
        beforeRow &&
        homeScore !== null &&
        awayScore !== null &&
        isGoal({ homeScore: beforeRow.home_score, awayScore: beforeRow.away_score }, { homeScore, awayScore })
      ) {
        sendGoalNotifications(supabase, {
          competitionKey: 'league',
          homeTeamId: beforeRow.home_team_id,
          awayTeamId: beforeRow.away_team_id,
          homeName: beforeRow.home_team?.name ?? 'Domicile',
          awayName: beforeRow.away_team?.name ?? 'Extérieur',
          homeScore,
          awayScore,
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

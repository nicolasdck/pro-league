import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { D1_CLUB_ALIASES } from '../src/lib/d1ClubAliases.js';
import {
  discoverPhaseLinks,
  fetchHtml,
  fetchPenaltyScore,
  parseMatchesFromHtml,
  sleep,
  REQUEST_DELAY_MS,
} from '../src/lib/footmercatoScraper.js';

// Croky Cup (Belgian Cup) has no working free API (api-sports.io's free plan
// blocks the current season for this competition, same as the league;
// TheSportsDB doesn't have it in its catalog at all — see README). Instead,
// this scrapes footmercato.net's calendar pages via src/lib/footmercatoScraper.ts.
//
// D1 clubs enter late (16 at the "Seizièmes de finale", 2 — KV Kortrijk and
// Lommel SK — at the "6e tour"), so only those phases onward are fetched;
// the ~270 amateur-club matches in rounds 1-5 are never relevant and never
// scraped.
const BASE_URL = 'https://www.footmercato.net/belgique/coupe-de-belgique/calendrier/';

const RELEVANT_PHASES: Array<{ slug: string; label: string }> = [
  { slug: 'phase-6th-round', label: '6e tour' },
  { slug: 'phase-16th-finals', label: 'Seizièmes de finale' },
  { slug: 'phase-8th-finals', label: 'Huitièmes de finale' },
  { slug: 'phase-quarter-finals', label: 'Quarts de finale' },
  { slug: 'phase-semi-finals', label: 'Demi-finales' },
  { slug: 'phase-final', label: 'Finale' },
];

interface CupFixtureRow {
  id: string; // footmercato's data-live-id exceeds Number.MAX_SAFE_INTEGER — keep as string
  phase: string;
  event_date: string | null;
  status: 'NS' | 'FT';
  home_team_id: number | null;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_id: number | null;
  away_team_name: string;
  away_team_logo: string | null;
  home_score: number | null;
  away_score: number | null;
  home_penalty: number | null;
  away_penalty: number | null;
  match_url: string | null;
  source_url: string;
  updated_at: string;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function logSync(
  supabase: SupabaseClient,
  requestsUsed: number,
  success: boolean,
  message?: string,
): Promise<void> {
  await supabase.from('sync_logs').insert({ resource: 'cup_fixtures', requests_used: requestsUsed, success, message });
}

async function syncCupFixtures(supabase: SupabaseClient): Promise<{ requestsUsed: number; fixturesFound: number }> {
  const phaseLinks = await discoverPhaseLinks(BASE_URL);
  let requestsUsed = 1; // the base calendar page fetched by discoverPhaseLinks
  const now = new Date().toISOString();
  const allRows: CupFixtureRow[] = [];

  for (const phase of RELEVANT_PHASES) {
    const link = phaseLinks.find((l) => l.slug === phase.slug);
    if (!link) continue; // phase not published/linked yet (e.g. draw not made)

    const html = await fetchHtml(link.url);
    requestsUsed += 1;

    for (const match of parseMatchesFromHtml(html, link.url)) {
      const homeTeamId = D1_CLUB_ALIASES[match.homeName] ?? null;
      const awayTeamId = D1_CLUB_ALIASES[match.awayName] ?? null;
      if (homeTeamId === null && awayTeamId === null) continue; // no D1 club involved, skip

      // A draw might have been settled on penalties (single-match knockout
      // rounds) — the calendar listing never shows it, only the detail page
      // does, so a tied result is worth the one extra request to check.
      let homePenalty: number | null = null;
      let awayPenalty: number | null = null;
      if (match.isPlayed && match.homeScore === match.awayScore && match.matchUrl) {
        await sleep(REQUEST_DELAY_MS);
        const penalty = await fetchPenaltyScore(match.matchUrl);
        requestsUsed += 1;
        if (penalty) {
          homePenalty = penalty.home;
          awayPenalty = penalty.away;
        }
      }

      allRows.push({
        id: match.liveId,
        phase: phase.label,
        event_date: match.eventDate,
        status: match.isPlayed ? 'FT' : 'NS',
        home_team_id: homeTeamId,
        home_team_name: match.homeName,
        home_team_logo: match.homeLogo,
        away_team_id: awayTeamId,
        away_team_name: match.awayName,
        away_team_logo: match.awayLogo,
        home_score: match.homeScore,
        away_score: match.awayScore,
        home_penalty: homePenalty,
        away_penalty: awayPenalty,
        match_url: match.matchUrl,
        source_url: link.url,
        updated_at: now,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (allRows.length > 0) {
    const { error } = await supabase.from('cup_fixtures').upsert(allRows, { onConflict: 'id' });
    if (error) throw error;
  }

  return { requestsUsed, fixturesFound: allRows.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    (req.query.secret as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
  if (cronSecret && providedSecret !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
    return;
  }

  try {
    const { requestsUsed, fixturesFound } = await syncCupFixtures(supabase);
    await logSync(supabase, requestsUsed, true, `${fixturesFound} D1 fixture(s) found`);
    res.status(200).json({ success: true, requestsUsed, fixturesFound });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logSync(supabase, 0, false, message).catch(() => undefined);
    res.status(500).json({ success: false, error: message });
  }
}

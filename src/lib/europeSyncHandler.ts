import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { D1_CLUB_ALIASES } from './d1ClubAliases.js';
import { discoverPhaseLinks, fetchHtml, parseMatchesFromHtml, sleep, REQUEST_DELAY_MS } from './footmercatoScraper.js';

// Factory for the three near-identical european sync endpoints
// (api/sync-cl.ts, sync-el.ts, sync-ecl.ts) — same footmercato scraping
// engine as the Croky Cup (src/lib/footmercatoScraper.ts), but unlike the
// Cup there's no fixed set of "relevant" phases to filter to: a Belgian
// club can appear anywhere from the 1st qualifying round through the final
// depending on its coefficient/pot, so every phase currently linked from
// the competition's base calendar page is fetched.
export type EuropeanCompetitionCode = 'CL' | 'EL' | 'ECL';

interface EuropeanFixtureRow {
  id: string; // footmercato's data-live-id exceeds Number.MAX_SAFE_INTEGER — keep as string
  competition: EuropeanCompetitionCode;
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
  source_url: string;
  updated_at: string;
}

const PHASE_LABELS: Record<string, string> = {
  'phase-1st-qualifying-round': '1er tour de qualification',
  'phase-2nd-qualifying-round': '2e tour de qualification',
  'phase-3rd-qualifying-round': '3e tour de qualification',
  'phase-play-offs': 'Barrages',
  'phase-league-stage': 'Phase de ligue',
  'phase-knockout-round-play-offs': 'Barrages (accès aux 8es)',
  'phase-8th-finals': 'Huitièmes de finale',
  'phase-quarter-finals': 'Quarts de finale',
  'phase-semi-finals': 'Demi-finales',
  'phase-final': 'Finale',
};

function labelForPhaseSlug(slug: string): string {
  const journeeMatch = slug.match(/^journee-(\d+)$/);
  if (journeeMatch) return `Journée ${journeeMatch[1]}`;
  return PHASE_LABELS[slug] ?? slug;
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
  competition: EuropeanCompetitionCode,
  requestsUsed: number,
  success: boolean,
  message?: string,
): Promise<void> {
  await supabase
    .from('sync_logs')
    .insert({ resource: `european_fixtures:${competition}`, requests_used: requestsUsed, success, message });
}

async function syncEuropeanFixtures(
  supabase: SupabaseClient,
  competition: EuropeanCompetitionCode,
  baseUrl: string,
): Promise<{ requestsUsed: number; fixturesFound: number }> {
  const phaseLinks = await discoverPhaseLinks(baseUrl);
  let requestsUsed = 1; // the base calendar page fetched by discoverPhaseLinks
  const now = new Date().toISOString();
  const allRows: EuropeanFixtureRow[] = [];

  for (const link of phaseLinks) {
    const html = await fetchHtml(link.url);
    requestsUsed += 1;

    for (const match of parseMatchesFromHtml(html)) {
      const homeTeamId = D1_CLUB_ALIASES[match.homeName] ?? null;
      const awayTeamId = D1_CLUB_ALIASES[match.awayName] ?? null;
      if (homeTeamId === null && awayTeamId === null) continue; // no Belgian club involved, skip

      allRows.push({
        id: match.liveId,
        competition,
        phase: labelForPhaseSlug(link.slug),
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
        source_url: link.url,
        updated_at: now,
      });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (allRows.length > 0) {
    const { error } = await supabase.from('european_fixtures').upsert(allRows, { onConflict: 'id' });
    if (error) throw error;
  }

  return { requestsUsed, fixturesFound: allRows.length };
}

export function createEuropeSyncHandler(competition: EuropeanCompetitionCode, baseUrl: string) {
  return async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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
      const { requestsUsed, fixturesFound } = await syncEuropeanFixtures(supabase, competition, baseUrl);
      await logSync(supabase, competition, requestsUsed, true, `${fixturesFound} Belgian fixture(s) found`);
      res.status(200).json({ success: true, competition, requestsUsed, fixturesFound });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await logSync(supabase, competition, 0, false, message).catch(() => undefined);
      res.status(500).json({ success: false, error: message });
    }
  };
}

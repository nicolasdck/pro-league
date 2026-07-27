import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { currentSeason } from '../src/lib/season.js';

// Belgian Pro League on TheSportsDB. Its free tier (test key "123", or any
// personal key) gives access to the *current* season, unlike API-Football's
// free plan which is locked to a fixed window of past seasons.
const LEAGUE_ID = '4338';
const API_BASE = 'https://www.thesportsdb.com/api/v1/json';

// `eventsseason.php` truncates to the first 15 fixtures on the free tier, so
// the full calendar is assembled round by round instead. A round-robin Pro
// League season (regular season + playoffs) never exceeds this many rounds.
const MAX_ROUNDS = 45;
// Stop scanning once we hit this many empty rounds in a row, but only after
// a safe minimum so we don't bail out on a real mid-season gap.
const CONSECUTIVE_EMPTY_ROUNDS_TO_STOP = 3;
const MIN_ROUNDS_BEFORE_STOP = 6;
// Space out requests to stay well under the free tier's rate limit.
// The shared "123" key is hammered by every free-tier caller worldwide, and
// its Cloudflare WAF bans an offending IP outright (HTTP 429) well before the
// documented 30 req/min, so this is intentionally conservative.
const REQUEST_DELAY_MS = 1500;

// The league table is computed client-side from these fixtures instead of
// TheSportsDB's lookuptable.php, which caps results at 5 rows on the free
// tier — even for a fully completed season (verified). There is nothing else
// to sync, so this is the only resource this endpoint fetches.

interface SportsDbEvent {
  idEvent: string;
  intRound: string;
  strTimestamp: string;
  strStatus: string;
  strPostponed: string;
  idHomeTeam: string;
  strHomeTeam: string;
  strHomeTeamBadge: string | null;
  idAwayTeam: string;
  strAwayTeam: string;
  strAwayTeamBadge: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
}

interface TeamUpsert {
  id: number;
  name: string;
  logo: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSeasonRange(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function sportsDbGet<T>(path: string, attempt = 1): Promise<T> {
  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey) throw new Error('Missing THESPORTSDB_API_KEY environment variable');

  const response = await fetch(`${API_BASE}/${apiKey}${path}`);
  if (response.status === 429 && attempt <= 4) {
    await sleep(5000 * attempt);
    return sportsDbGet<T>(path, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

async function logSync(
  supabase: SupabaseClient,
  requestsUsed: number,
  success: boolean,
  message?: string,
): Promise<void> {
  await supabase.from('sync_logs').insert({ resource: 'fixtures', requests_used: requestsUsed, success, message });
}

// Logos are downloaded once into public/team-logos/ (see scripts/localize-logos.mjs)
// so the app never hotlinks a third-party CDN. A serverless sync can't write
// to the deployed repo, so once a team's logo has been localized (path starts
// with "/"), subsequent syncs must leave that column alone and only refresh
// the name — otherwise every sync would revert it back to the external URL.
async function upsertTeams(supabase: SupabaseClient, teams: TeamUpsert[]): Promise<void> {
  if (teams.length === 0) return;
  const uniqueTeams = Array.from(new Map(teams.map((team) => [team.id, team])).values());

  const { data: existing, error: fetchError } = await supabase
    .from('teams')
    .select('id, logo')
    .in('id', uniqueTeams.map((team) => team.id));
  if (fetchError) throw fetchError;
  const localizedIds = new Set(
    (existing ?? []).filter((team) => team.logo?.startsWith('/')).map((team) => team.id),
  );

  const newTeams = uniqueTeams.filter((team) => !localizedIds.has(team.id));
  const knownTeams = uniqueTeams
    .filter((team) => localizedIds.has(team.id))
    .map(({ id, name }) => ({ id, name }));

  if (newTeams.length > 0) {
    const { error } = await supabase.from('teams').upsert(newTeams, { onConflict: 'id' });
    if (error) throw error;
  }
  if (knownTeams.length > 0) {
    const { error } = await supabase.from('teams').upsert(knownTeams, { onConflict: 'id' });
    if (error) throw error;
  }
}

async function fetchSeasonEvents(season: number): Promise<{ events: SportsDbEvent[]; requestsUsed: number }> {
  const events: SportsDbEvent[] = [];
  let requestsUsed = 0;
  let consecutiveEmptyRounds = 0;

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const json = await sportsDbGet<{ events: SportsDbEvent[] | null }>(
      `/eventsround.php?id=${LEAGUE_ID}&r=${round}&s=${toSeasonRange(season)}`,
    );
    requestsUsed += 1;
    const roundEvents = json.events ?? [];

    if (roundEvents.length === 0) {
      consecutiveEmptyRounds += 1;
      if (round >= MIN_ROUNDS_BEFORE_STOP && consecutiveEmptyRounds >= CONSECUTIVE_EMPTY_ROUNDS_TO_STOP) {
        break;
      }
    } else {
      consecutiveEmptyRounds = 0;
      events.push(...roundEvents);
    }

    if (round < MAX_ROUNDS) await sleep(REQUEST_DELAY_MS);
  }

  return { events, requestsUsed };
}

function mapEventStatus(event: SportsDbEvent): string {
  if (event.strPostponed === 'yes') return 'PST';
  return event.strStatus || 'NS';
}

async function syncFixtures(supabase: SupabaseClient, season: number): Promise<number> {
  const { events, requestsUsed } = await fetchSeasonEvents(season);

  const teams: TeamUpsert[] = events.flatMap((event) => [
    { id: Number(event.idHomeTeam), name: event.strHomeTeam, logo: event.strHomeTeamBadge },
    { id: Number(event.idAwayTeam), name: event.strAwayTeam, logo: event.strAwayTeamBadge },
  ]);
  await upsertTeams(supabase, teams);

  const rows = events.map((event) => ({
    id: Number(event.idEvent),
    season,
    round: `Journée ${event.intRound}`,
    event_date: `${event.strTimestamp}Z`,
    status: mapEventStatus(event),
    home_team_id: Number(event.idHomeTeam),
    away_team_id: Number(event.idAwayTeam),
    home_score: event.intHomeScore === null ? null : Number(event.intHomeScore),
    away_score: event.intAwayScore === null ? null : Number(event.intAwayScore),
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from('fixtures').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  return requestsUsed;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    (req.query.secret as string | undefined) ?? req.headers.authorization?.replace('Bearer ', '');
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
    const requestsUsed = await syncFixtures(supabase, season);
    await logSync(supabase, requestsUsed, true);
    res.status(200).json({ success: true, season, requestsUsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logSync(supabase, 0, false, message).catch(() => undefined);
    res.status(500).json({ success: false, error: message });
  }
}

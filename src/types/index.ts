export interface Team {
  id: number;
  name: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
}

export type EuropeanCompetition = 'CL' | 'EL' | 'ECL';

export interface Standing {
  teamId: number;
  season: number;
  rank: number;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  team: Team;
  europeanCompetition?: EuropeanCompetition;
}

// Short match-status codes, originally TheSportsDB's vocabulary — kept as
// the shared vocabulary across every source (footmercato scraping for D1/
// Cup/Europe only ever produces 'NS' | '1H' | 'FT', see api/sync-d1.ts and
// api/live-scores.ts, but the full set stays meaningful for historical rows
// and cross-source consistency).
export type FixtureStatus =
  | 'NS' // Not Started
  | '1H'
  | 'HT'
  | '2H'
  | 'ET'
  | 'P'
  | 'FT'
  | 'AET'
  | 'PEN'
  | 'PST'
  | 'CANC'
  | 'ABD'
  | 'AWD'
  | 'WO';

// A result should only count toward standings/form once the match has
// actually finished — a live score (e.g. 1-0 at half-time) must not be
// tallied as a completed result. Shared by standings.ts and StatusBadge.tsx.
export const FINISHED_FIXTURE_STATUSES: readonly FixtureStatus[] = ['FT', 'AET', 'PEN'];

export function isFinishedFixtureStatus(status: FixtureStatus): boolean {
  return FINISHED_FIXTURE_STATUSES.includes(status);
}

export const LIVE_FIXTURE_STATUSES: readonly FixtureStatus[] = ['1H', 'HT', '2H', 'ET', 'P'];

export function isLiveFixtureStatus(status: FixtureStatus): boolean {
  return LIVE_FIXTURE_STATUSES.includes(status);
}

// For display purposes only ("show the score, not the kickoff time") — a
// live match has a real score just as a finished one does, unlike
// isFinishedFixtureStatus which gates whether it counts toward standings.
export function hasFixtureScore(status: FixtureStatus): boolean {
  return isFinishedFixtureStatus(status) || isLiveFixtureStatus(status);
}

export interface Fixture {
  id: number;
  season: number;
  round: string;
  eventDate: string;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: Team;
  awayTeam: Team;
}

// Croky Cup / European opponents are frequently non-D1 clubs with no entry
// in `teams` (see src/lib/d1ClubAliases.ts), so each side is its own
// name/logo/isD1 trio instead of a full Team reference.
export interface MatchOpponent {
  id: number | null;
  name: string;
  logo: string | null;
  isD1: boolean;
}

export interface CupFixture {
  id: string; // footmercato id exceeds Number.MAX_SAFE_INTEGER
  phase: string;
  eventDate: string | null; // null until footmercato schedules the match
  // Normally 'NS' | 'FT'; can also be '1H' while api/live-scores-euro.ts is
  // actively polling it (see useLiveScorePollingEuro) — footmercato's
  // markup doesn't reliably expose which half/phase, so '1H' is used purely
  // as a generic "kicked off, not finished yet" marker, not a literal claim
  // about the first half. StatusBadge already renders it as plain "En cours".
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePenalty: number | null; // set only when the tie was decided on penalties
  awayPenalty: number | null;
  matchUrl: string | null; // footmercato detail page, used to load buteurs/cartons on demand
  homeTeam: MatchOpponent;
  awayTeam: MatchOpponent;
}

export interface EuropeanFixture {
  id: string; // footmercato id exceeds Number.MAX_SAFE_INTEGER
  competition: EuropeanCompetition;
  phase: string;
  eventDate: string | null;
  // See CupFixture.status — same 'NS' | '1H' | 'FT' semantics.
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePenalty: number | null; // set only when the tie was decided on penalties
  awayPenalty: number | null;
  matchUrl: string | null; // footmercato detail page, used to load buteurs/cartons on demand
  homeTeam: MatchOpponent;
  awayTeam: MatchOpponent;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  imageUrl: string | null;
  articleType: string;
  publishedAt: string;
  teamIds: number[];
}

export type PlayerStatKind = 'goals' | 'assists';

export interface PlayerStat {
  kind: PlayerStatKind;
  rank: number;
  playerName: string;
  playerImage: string | null;
  teamId: number | null;
  teamName: string;
  teamLogo: string | null;
  position: string | null;
  value: number;
}

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

// Short match-status codes as returned by TheSportsDB (NS, FT, PST are confirmed
// on the free tier; the live in-play codes only apply if a premium livescore
// plan is added later).
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
  status: Extract<FixtureStatus, 'NS' | 'FT'>;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: MatchOpponent;
  awayTeam: MatchOpponent;
}

export interface EuropeanFixture {
  id: string; // footmercato id exceeds Number.MAX_SAFE_INTEGER
  competition: EuropeanCompetition;
  phase: string;
  eventDate: string | null;
  status: Extract<FixtureStatus, 'NS' | 'FT'>;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: MatchOpponent;
  awayTeam: MatchOpponent;
}

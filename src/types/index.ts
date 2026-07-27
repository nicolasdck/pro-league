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

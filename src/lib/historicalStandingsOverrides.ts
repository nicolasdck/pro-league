export interface StandingOverrideRow {
  teamId: number; // TheSportsDB id
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

// Official final 2025-26 Belgian Pro League standings, entered by hand from
// the league's own results page. The fixture-aggregation this app otherwise
// uses can't reproduce this season: after the 30-game regular season, points
// are halved and three playoff groups (Championship / Europe / Relegation)
// are played on top, which a flat 3-1-0 tally over all games doesn't match.
// Ordered by final overall rank (Championship playoffs 1-6, Europe
// playoffs 7-12, Relegation playoffs 13-16).
const SEASON_2025_26: StandingOverrideRow[] = [
  // Championship playoffs
  { teamId: 133789, played: 40, win: 28, draw: 4, lose: 8, goalsFor: 91, goalsAgainst: 45, points: 57 }, // Club Brugge
  { teamId: 138141, played: 40, win: 25, draw: 11, lose: 4, goalsFor: 66, goalsAgainst: 27, points: 53 }, // Union Saint-Gilloise
  { teamId: 135461, played: 40, win: 22, draw: 5, lose: 13, goalsFor: 61, goalsAgainst: 46, points: 43 }, // Sint-Truiden
  { teamId: 133776, played: 40, win: 15, draw: 10, lose: 15, goalsFor: 59, goalsAgainst: 62, points: 33 }, // Anderlecht
  { teamId: 133781, played: 40, win: 13, draw: 12, lose: 15, goalsFor: 53, goalsAgainst: 57, points: 29 }, // Gent
  { teamId: 133787, played: 40, win: 13, draw: 12, lose: 15, goalsFor: 48, goalsAgainst: 61, points: 29 }, // Mechelen
  // Europe playoffs
  { teamId: 133779, played: 40, win: 15, draw: 14, lose: 11, goalsFor: 57, goalsAgainst: 53, points: 38 }, // Genk
  { teamId: 133778, played: 40, win: 16, draw: 9, lose: 15, goalsFor: 44, goalsAgainst: 46, points: 37 }, // Standard Liège
  { teamId: 133826, played: 40, win: 14, draw: 9, lose: 17, goalsFor: 50, goalsAgainst: 50, points: 34 }, // Charleroi
  { teamId: 133790, played: 40, win: 14, draw: 10, lose: 16, goalsFor: 50, goalsAgainst: 57, points: 33 }, // Westerlo
  { teamId: 134245, played: 40, win: 13, draw: 9, lose: 18, goalsFor: 43, goalsAgainst: 48, points: 31 }, // Antwerp
  { teamId: 133775, played: 40, win: 10, draw: 10, lose: 20, goalsFor: 41, goalsAgainst: 60, points: 23 }, // Oud-Heverlee Leuven
  // Relegation playoffs
  { teamId: 133786, played: 36, win: 13, draw: 9, lose: 14, goalsFor: 53, goalsAgainst: 53, points: 48 }, // Zulte Waregem
  { teamId: 133782, played: 36, win: 10, draw: 11, lose: 15, goalsFor: 53, goalsAgainst: 58, points: 41 }, // Cercle Brugge
  { teamId: 148488, played: 36, win: 7, draw: 13, lose: 16, goalsFor: 35, goalsAgainst: 50, points: 34 }, // RAAL La Louvière
  { teamId: 133863, played: 36, win: 5, draw: 10, lose: 21, goalsFor: 31, goalsAgainst: 62, points: 25 }, // Dender
];

export const HISTORICAL_STANDINGS_OVERRIDES: Record<number, StandingOverrideRow[]> = {
  2025: SEASON_2025_26,
};

import type { Fixture, Standing, Team } from '../types';
import { getEuropeanCompetition } from './europeanQualification';
import type { StandingOverrideRow } from './historicalStandingsOverrides';

interface TeamTotals {
  teamId: number;
  team: Team;
  points: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
}

// Team list is derived from the fixtures themselves (not a global team
// table) so a season's computed table only ever includes teams actually
// scheduled to play that season — otherwise clubs relegated/promoted in a
// different season would leak into every other season's table at 0 pts.
function tallyFixtures(fixtures: Fixture[]): Map<number, TeamTotals> {
  const totals = new Map<number, TeamTotals>();

  const ensure = (team: Team): TeamTotals => {
    let totalsRow = totals.get(team.id);
    if (!totalsRow) {
      totalsRow = { teamId: team.id, team, points: 0, played: 0, win: 0, draw: 0, lose: 0, goalsFor: 0, goalsAgainst: 0 };
      totals.set(team.id, totalsRow);
    }
    return totalsRow;
  };

  for (const fixture of fixtures) {
    const home = ensure(fixture.homeTeam);
    const away = ensure(fixture.awayTeam);
    if (fixture.homeScore === null || fixture.awayScore === null) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.homeScore;
    home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore;
    away.goalsAgainst += fixture.homeScore;

    if (fixture.homeScore > fixture.awayScore) {
      home.win += 1;
      home.points += 3;
      away.lose += 1;
    } else if (fixture.homeScore < fixture.awayScore) {
      away.win += 1;
      away.points += 3;
      home.lose += 1;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return totals;
}

/**
 * Computes a league table from raw fixture results instead of relying on
 * TheSportsDB's lookuptable.php, which is capped at 5 rows on the free tier
 * (confirmed even for fully completed seasons). Exact from the 2026-27
 * season onward (flat double round-robin, no playoffs); an approximation
 * for earlier seasons, which used Championship/Europe/Relegation playoff
 * groups with points halved mid-season that this doesn't reproduce.
 *
 * `previousSeasonRanks` breaks ties using last season's final rank instead
 * of alphabetical order — used so the current season's table, before any
 * match has been played (everyone tied at 0), reads as last year's finish
 * rather than an arbitrary A-Z list.
 */
export function computeStandings(
  fixtures: Fixture[],
  season: number,
  previousSeasonRanks?: Map<number, number>,
): Standing[] {
  const unranked = Array.from(tallyFixtures(fixtures).values());

  unranked.sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    const goalDiffA = a.goalsFor - a.goalsAgainst;
    const goalDiffB = b.goalsFor - b.goalsAgainst;
    if (goalDiffA !== goalDiffB) return goalDiffB - goalDiffA;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    if (previousSeasonRanks) {
      const rankA = previousSeasonRanks.get(a.teamId) ?? Infinity;
      const rankB = previousSeasonRanks.get(b.teamId) ?? Infinity;
      if (rankA !== rankB) return rankA - rankB;
    }
    return a.team.name.localeCompare(b.team.name);
  });

  return unranked.map((row, index) => ({
    teamId: row.teamId,
    season,
    rank: index + 1,
    points: row.points,
    played: row.played,
    win: row.win,
    draw: row.draw,
    lose: row.lose,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    team: row.team,
    europeanCompetition: getEuropeanCompetition(season, row.teamId),
  }));
}

export type FormResult = 'W' | 'D' | 'L';

/**
 * Last `limit` played results for a team, oldest first (so it reads
 * left-to-right as a timeline) — computed straight from fixtures rather
 * than tallied standings, since it needs per-match outcomes rather than
 * season totals.
 */
export function computeRecentForm(fixtures: Fixture[], teamId: number, limit = 5): FormResult[] {
  const played = fixtures
    .filter(
      (fixture) =>
        (fixture.homeTeam.id === teamId || fixture.awayTeam.id === teamId) &&
        fixture.homeScore !== null &&
        fixture.awayScore !== null,
    )
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
    .slice(0, limit);

  return played
    .map((fixture): FormResult => {
      const isHome = fixture.homeTeam.id === teamId;
      const goalsFor = (isHome ? fixture.homeScore : fixture.awayScore)!;
      const goalsAgainst = (isHome ? fixture.awayScore : fixture.homeScore)!;
      if (goalsFor > goalsAgainst) return 'W';
      if (goalsFor < goalsAgainst) return 'L';
      return 'D';
    })
    .reverse();
}

/**
 * Builds a Standing[] from hand-entered official results (see
 * historicalStandingsOverrides.ts), for seasons where the playoff points
 * system makes fixture-aggregation inaccurate. Rows are expected to already
 * be in final rank order.
 */
export function buildStandingsFromOverride(
  rows: StandingOverrideRow[],
  teams: Team[],
  season: number,
): Standing[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  return rows.map((row, index) => ({
    teamId: row.teamId,
    season,
    rank: index + 1,
    points: row.points,
    played: row.played,
    win: row.win,
    draw: row.draw,
    lose: row.lose,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    team: teamById.get(row.teamId)!,
    europeanCompetition: getEuropeanCompetition(season, row.teamId),
  }));
}

import { useMemo } from 'react';
import { useFixtures } from './useFixtures';
import { useTeams } from './useTeams';
import { computeStandings, buildStandingsFromOverride } from '../lib/standings';
import { HISTORICAL_STANDINGS_OVERRIDES } from '../lib/historicalStandingsOverrides';
import { currentSeason } from '../lib/season';
import type { Fixture, Standing, Team } from '../types';

interface UseStandingsResult {
  data: Standing[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

function standingsForSeason(
  season: number,
  teams: Team[],
  fixtures: Fixture[] | undefined,
  previousSeasonRanks?: Map<number, number>,
): Standing[] | undefined {
  const override = HISTORICAL_STANDINGS_OVERRIDES[season];
  if (override) return buildStandingsFromOverride(override, teams, season);
  if (!fixtures) return undefined;
  return computeStandings(fixtures, season, previousSeasonRanks);
}

export function useStandings(season: number = currentSeason()): UseStandingsResult {
  const isCurrentSeason = season === currentSeason();
  const hasOverride = season in HISTORICAL_STANDINGS_OVERRIDES;
  const previousHasOverride = season - 1 in HISTORICAL_STANDINGS_OVERRIDES;

  const teamsQuery = useTeams();
  const fixturesQuery = useFixtures(season, { enabled: !hasOverride });
  // Before the current season has any result, sort by last season's final
  // rank instead of alphabetically (see src/lib/standings.ts).
  const previousFixturesQuery = useFixtures(season - 1, {
    enabled: isCurrentSeason && !previousHasOverride,
  });

  const data = useMemo<Standing[] | undefined>(() => {
    if (!teamsQuery.data) return undefined;

    if (!isCurrentSeason) {
      return standingsForSeason(season, teamsQuery.data, fixturesQuery.data);
    }

    const previousStandings = standingsForSeason(season - 1, teamsQuery.data, previousFixturesQuery.data);
    if (!previousStandings) return undefined;

    const previousRanks = new Map(previousStandings.map((standing) => [standing.teamId, standing.rank]));
    return standingsForSeason(season, teamsQuery.data, fixturesQuery.data, previousRanks);
  }, [teamsQuery.data, fixturesQuery.data, previousFixturesQuery.data, isCurrentSeason, season]);

  return {
    data,
    isLoading:
      teamsQuery.isLoading ||
      (!hasOverride && fixturesQuery.isLoading) ||
      (isCurrentSeason && !previousHasOverride && previousFixturesQuery.isLoading),
    isError: teamsQuery.isError || fixturesQuery.isError || previousFixturesQuery.isError,
  };
}

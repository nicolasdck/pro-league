import { useMemo } from 'react';
import { useFixtures } from './useFixtures';
import { useTeams } from './useTeams';
import { computeStandings, buildStandingsFromOverride, computeRecentForm, type FormResult } from '../lib/standings';
import { HISTORICAL_STANDINGS_OVERRIDES } from '../lib/historicalStandingsOverrides';
import { currentSeason } from '../lib/season';
import type { Fixture, Standing, Team } from '../types';

interface UseStandingsResult {
  data: Standing[] | undefined;
  // Only populated for seasons computed straight from fixtures (no hand-entered
  // override) — a fully completed historical season's "recent form" isn't
  // meaningful, so it's left empty rather than reconstructed.
  recentForm: Map<number, FormResult[]>;
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

  const recentForm = useMemo<Map<number, FormResult[]>>(() => {
    const map = new Map<number, FormResult[]>();
    if (hasOverride || !data || !fixturesQuery.data) return map;
    for (const standing of data) {
      map.set(standing.teamId, computeRecentForm(fixturesQuery.data, standing.teamId));
    }
    return map;
  }, [data, fixturesQuery.data, hasOverride]);

  return {
    data,
    recentForm,
    isLoading:
      teamsQuery.isLoading ||
      (!hasOverride && fixturesQuery.isLoading) ||
      (isCurrentSeason && !previousHasOverride && previousFixturesQuery.isLoading),
    isError: teamsQuery.isError || fixturesQuery.isError || previousFixturesQuery.isError,
  };
}

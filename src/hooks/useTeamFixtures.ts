import { useMemo } from 'react';
import { useFixtures } from './useFixtures';
import { useCupFixtures } from './useCupFixtures';
import { useEuropeanFixtures } from './useEuropeanFixtures';
import { currentSeason } from '../lib/season';
import type { CupFixture, EuropeanCompetition, EuropeanFixture, Fixture, FixtureStatus } from '../types';

export type CompetitionKind = 'league' | 'cup' | EuropeanCompetition;

export const COMPETITION_LABELS: Record<CompetitionKind, string> = {
  league: 'Championnat',
  cup: 'Coupe de Belgique',
  CL: 'Ligue des Champions',
  EL: 'Europa League',
  ECL: 'Conference League',
};

// Minimal shape merging Fixture (league, full Team refs) and CupFixture /
// EuropeanFixture (MatchOpponent — non-D1 opponents have no `teams` row) —
// only what this cross-competition timeline actually renders.
export interface UnifiedFixture {
  id: string;
  competitionKind: CompetitionKind;
  round: string;
  eventDate: string | null;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePenalty: number | null;
  awayPenalty: number | null;
  homeName: string;
  homeLogo: string | null;
  awayName: string;
  awayLogo: string | null;
}

function fromLeague(fixtures: Fixture[], teamId: number): UnifiedFixture[] {
  return fixtures
    .filter((f) => f.homeTeam.id === teamId || f.awayTeam.id === teamId)
    .map((f) => ({
      id: `league-${f.id}`,
      competitionKind: 'league' as const,
      round: f.round,
      eventDate: f.eventDate,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      homePenalty: null,
      awayPenalty: null,
      homeName: f.homeTeam.name,
      homeLogo: f.homeTeam.logo,
      awayName: f.awayTeam.name,
      awayLogo: f.awayTeam.logo,
    }));
}

function fromCup(fixtures: CupFixture[], teamId: number): UnifiedFixture[] {
  return fixtures
    .filter((f) => f.homeTeam.id === teamId || f.awayTeam.id === teamId)
    .map((f) => ({
      id: `cup-${f.id}`,
      competitionKind: 'cup' as const,
      round: f.phase,
      eventDate: f.eventDate,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      homePenalty: f.homePenalty,
      awayPenalty: f.awayPenalty,
      homeName: f.homeTeam.name,
      homeLogo: f.homeTeam.logo,
      awayName: f.awayTeam.name,
      awayLogo: f.awayTeam.logo,
    }));
}

function fromEuropean(competition: EuropeanCompetition, fixtures: EuropeanFixture[], teamId: number): UnifiedFixture[] {
  return fixtures
    .filter((f) => f.homeTeam.id === teamId || f.awayTeam.id === teamId)
    .map((f) => ({
      id: `${competition}-${f.id}`,
      competitionKind: competition,
      round: f.phase,
      eventDate: f.eventDate,
      status: f.status,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      homePenalty: f.homePenalty,
      awayPenalty: f.awayPenalty,
      homeName: f.homeTeam.name,
      homeLogo: f.homeTeam.logo,
      awayName: f.awayTeam.name,
      awayLogo: f.awayTeam.logo,
    }));
}

// Merges league + Croky Cup + CL/EL/ECL into one chronological timeline for
// a single team — none of the four sources otherwise cross-reference each
// other, so "what does my week look like" means checking four screens
// without this.
export function useTeamFixtures(teamId: number | null) {
  const leagueQuery = useFixtures(currentSeason(), { enabled: teamId !== null });
  const cupQuery = useCupFixtures();
  const clQuery = useEuropeanFixtures('CL');
  const elQuery = useEuropeanFixtures('EL');
  const eclQuery = useEuropeanFixtures('ECL');

  const isLoading =
    teamId !== null &&
    (leagueQuery.isLoading || cupQuery.isLoading || clQuery.isLoading || elQuery.isLoading || eclQuery.isLoading);
  const isError =
    leagueQuery.isError || cupQuery.isError || clQuery.isError || elQuery.isError || eclQuery.isError;

  const data = useMemo<UnifiedFixture[] | undefined>(() => {
    if (teamId === null) return [];
    if (!leagueQuery.data || !cupQuery.data || !clQuery.data || !elQuery.data || !eclQuery.data) return undefined;

    const merged = [
      ...fromLeague(leagueQuery.data, teamId),
      ...fromCup(cupQuery.data, teamId),
      ...fromEuropean('CL', clQuery.data, teamId),
      ...fromEuropean('EL', elQuery.data, teamId),
      ...fromEuropean('ECL', eclQuery.data, teamId),
    ];

    return merged.sort((a, b) => (a.eventDate ?? '9999').localeCompare(b.eventDate ?? '9999'));
  }, [teamId, leagueQuery.data, cupQuery.data, clQuery.data, elQuery.data, eclQuery.data]);

  return { data, isLoading, isError };
}

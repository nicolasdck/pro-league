import type { EuropeanCompetition, EuropeanFixture } from '../types';
import { mapOpponent } from './cupMappers';
import type { TeamRow } from './mappers';

export interface EuropeanFixtureRow {
  id: string;
  competition: string;
  phase: string;
  event_date: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_penalty: number | null;
  away_penalty: number | null;
  home_team_name: string;
  home_team_logo: string | null;
  home_team: TeamRow | null;
  away_team_name: string;
  away_team_logo: string | null;
  away_team: TeamRow | null;
}

export function mapEuropeanFixture(row: EuropeanFixtureRow): EuropeanFixture {
  return {
    id: row.id,
    competition: row.competition as EuropeanCompetition,
    phase: row.phase,
    eventDate: row.event_date,
    status: row.status === 'FT' ? 'FT' : 'NS',
    homeScore: row.home_score,
    awayScore: row.away_score,
    homePenalty: row.home_penalty,
    awayPenalty: row.away_penalty,
    homeTeam: mapOpponent(row.home_team, row.home_team_name, row.home_team_logo),
    awayTeam: mapOpponent(row.away_team, row.away_team_name, row.away_team_logo),
  };
}

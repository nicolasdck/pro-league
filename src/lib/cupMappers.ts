import type { CupFixture, MatchOpponent } from '../types';
import { mapTeam, type TeamRow } from './mappers';

export interface CupFixtureRow {
  id: string;
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

// Shared with src/lib/europeanMappers.ts — same home/away shape (a possibly
// non-D1 opponent stored as plain name/logo, joined against `teams` when it
// is a D1 club) is used by both cup_fixtures and european_fixtures.
export function mapOpponent(
  team: TeamRow | null,
  fallbackName: string,
  fallbackLogo: string | null,
): MatchOpponent {
  if (team) {
    const mapped = mapTeam(team);
    return { id: mapped.id, name: mapped.name, logo: mapped.logo, isD1: true };
  }
  return { id: null, name: fallbackName, logo: fallbackLogo, isD1: false };
}

export function mapCupFixture(row: CupFixtureRow): CupFixture {
  return {
    id: row.id,
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

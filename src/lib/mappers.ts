import type { Fixture, FixtureStatus, Team } from '../types';

export interface TeamRow {
  id: number;
  name: string;
  logo: string | null;
  primary_color: string;
  secondary_color: string;
}

export interface FixtureRow {
  id: number;
  season: number;
  round: string;
  event_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_team: TeamRow;
  away_team: TeamRow;
}

export function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    logo: row.logo,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
  };
}

export function mapFixture(row: FixtureRow): Fixture {
  return {
    id: row.id,
    season: row.season,
    round: row.round,
    eventDate: row.event_date,
    status: row.status as FixtureStatus,
    homeScore: row.home_score,
    awayScore: row.away_score,
    homeTeam: mapTeam(row.home_team),
    awayTeam: mapTeam(row.away_team),
  };
}

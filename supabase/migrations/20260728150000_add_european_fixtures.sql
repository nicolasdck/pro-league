-- Champions/Europa/Conference League matches involving a Belgian (D1) club.
-- Same reasoning as cup_fixtures: opponents are foreign clubs, never in
-- `teams`, so only the Belgian side ever gets a home_team_id/away_team_id.
-- One table for all three competitions, distinguished by `competition`.
create table if not exists european_fixtures (
  id bigint primary key,
  competition text not null,
  phase text not null,
  event_date timestamptz,
  status text not null default 'NS',
  home_team_id integer references teams(id),
  home_team_name text not null,
  home_team_logo text,
  away_team_id integer references teams(id),
  away_team_name text not null,
  away_team_logo text,
  home_score integer,
  away_score integer,
  source_url text not null,
  updated_at timestamptz not null default now()
);

create index if not exists european_fixtures_competition_date_idx on european_fixtures (competition, event_date);

alter table european_fixtures enable row level security;
create policy "public read european_fixtures" on european_fixtures for select using (true);

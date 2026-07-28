-- Croky Cup (Belgian Cup) matches involving a D1 club. Opponents are
-- frequently non-D1 clubs not present in `teams`, so teams are stored as
-- plain name/logo pairs; home_team_id/away_team_id are only set when that
-- side is one of the 18 D1 clubs (see src/lib/cupClubAliases.ts).
create table if not exists cup_fixtures (
  id bigint primary key,
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

create index if not exists cup_fixtures_event_date_idx on cup_fixtures (event_date);

alter table cup_fixtures enable row level security;
create policy "public read cup_fixtures" on cup_fixtures for select using (true);

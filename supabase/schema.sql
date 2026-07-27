-- Jupiler Pro League PWA — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table if not exists teams (
  id integer primary key,                 -- TheSportsDB team id
  name text not null,
  logo text,
  primary_color text not null default '#6d28d9',
  secondary_color text not null default '#1f2937',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- fixtures
--
-- There is no separate "standings" table: the league table is computed
-- client-side from these results (see src/lib/standings.ts). From the
-- 2026-27 season onward the Pro League is a flat double round-robin (no
-- playoffs), so that computation is exact; for the 2023-24 through 2025-26
-- seasons backfilled for history it's an approximation, since those seasons
-- split into Championship/Europe/Relegation playoff groups with points
-- halved mid-season — a detail this app doesn't attempt to reproduce.
-- ---------------------------------------------------------------------------
create table if not exists fixtures (
  id integer primary key,                 -- TheSportsDB event id
  season integer not null,
  round text not null,
  event_date timestamptz not null,
  status text not null default 'NS',      -- short status (NS, FT, PST on the free tier; live codes need a paid livescore plan)
  home_team_id integer not null references teams(id) on delete cascade,
  away_team_id integer not null references teams(id) on delete cascade,
  home_score integer,
  away_score integer,
  updated_at timestamptz not null default now()
);

create index if not exists fixtures_season_round_idx on fixtures (season, round);
create index if not exists fixtures_event_date_idx on fixtures (event_date);

-- ---------------------------------------------------------------------------
-- sync_logs — records each sync run for observability (requests used, success)
-- ---------------------------------------------------------------------------
create table if not exists sync_logs (
  id bigint generated always as identity primary key,
  resource text not null,                 -- always 'fixtures' for now
  requests_used integer not null default 0,
  success boolean not null default true,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists sync_logs_created_at_idx on sync_logs (created_at);

-- ---------------------------------------------------------------------------
-- user_preferences — optional Supabase Auth backing store for favorite team.
-- The client falls back to localStorage when the user has no Supabase session.
-- ---------------------------------------------------------------------------
create table if not exists user_preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  favorite_team_id integer references teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table teams enable row level security;
alter table fixtures enable row level security;
alter table sync_logs enable row level security;
alter table user_preferences enable row level security;

-- Public, read-only access for reference/content tables. All writes happen
-- server-side via the Supabase service role key (see api/sync.ts), which
-- bypasses RLS entirely, so no insert/update/delete policies are needed here.
create policy "public read teams" on teams for select using (true);
create policy "public read fixtures" on fixtures for select using (true);

-- sync_logs is operational data, not needed by the client.
create policy "service role only sync_logs" on sync_logs for all using (false);

-- user_preferences: authenticated users may only read/write their own row.
create policy "read own preferences" on user_preferences
  for select using (auth.uid() = id);
create policy "insert own preferences" on user_preferences
  for insert with check (auth.uid() = id);
create policy "update own preferences" on user_preferences
  for update using (auth.uid() = id);

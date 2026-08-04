-- Pro League PWA — Supabase schema
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
-- cup_fixtures — Croky Cup (Belgian Cup) matches involving a D1 club.
--
-- Unlike `fixtures`, opponents are frequently non-D1 clubs (Challenger Pro
-- League or amateur) that don't exist in `teams`, so teams are stored as
-- plain name/logo pairs; home_team_id/away_team_id are only set when that
-- side is one of the 18 D1 clubs (see src/lib/d1ClubAliases.ts), letting the
-- UI reuse `teams` for colors/local logos on that side.
--
-- Rounds before the D1 clubs enter (preliminary through 5th round, all-
-- amateur) are never scraped/stored — see api/sync-cup.ts.
-- ---------------------------------------------------------------------------
create table if not exists cup_fixtures (
  id bigint primary key,                  -- footmercato match id (data-live-id)
  phase text not null,                    -- '6e tour', 'Seizièmes de finale', ...
  event_date timestamptz,                 -- null until footmercato schedules the match
  status text not null default 'NS',      -- 'NS' | 'FT' (see src/types CupFixtureStatus)
  home_team_id integer references teams(id),
  home_team_name text not null,
  home_team_logo text,
  away_team_id integer references teams(id),
  away_team_name text not null,
  away_team_logo text,
  home_score integer,
  away_score integer,
  home_penalty integer,                   -- set only when decided on penalties
  away_penalty integer,
  match_url text,                         -- footmercato detail page, fetched on demand for buteurs/cartons
  source_url text not null,
  updated_at timestamptz not null default now()
);

create index if not exists cup_fixtures_event_date_idx on cup_fixtures (event_date);

-- ---------------------------------------------------------------------------
-- european_fixtures — Champions/Europa/Conference League matches involving
-- a Belgian (D1) club. Same shape and same reasoning as cup_fixtures (see
-- above) — opponents are foreign clubs, never in `teams`, so only the
-- Belgian side ever gets a home_team_id/away_team_id. One table for all
-- three competitions, distinguished by `competition`; see api/sync-cl.ts,
-- sync-el.ts, sync-ecl.ts (all three built from src/lib/europeSyncHandler.ts).
-- ---------------------------------------------------------------------------
create table if not exists european_fixtures (
  id bigint primary key,                  -- footmercato match id (data-live-id)
  competition text not null,              -- 'CL' | 'EL' | 'ECL'
  phase text not null,                    -- '3e tour de qualification', 'Journée 4', 'Quarts de finale', ...
  event_date timestamptz,
  status text not null default 'NS',      -- 'NS' | 'FT'
  home_team_id integer references teams(id),
  home_team_name text not null,
  home_team_logo text,
  away_team_id integer references teams(id),
  away_team_name text not null,
  away_team_logo text,
  home_score integer,
  away_score integer,
  home_penalty integer,                   -- set only when decided on penalties
  away_penalty integer,
  match_url text,                         -- footmercato detail page, fetched on demand for buteurs/cartons
  source_url text not null,
  updated_at timestamptz not null default now()
);

create index if not exists european_fixtures_competition_date_idx on european_fixtures (competition, event_date);

-- ---------------------------------------------------------------------------
-- news_items — transfer/news aggregated from footmercato's per-club news API
-- across the 18 D1 clubs (see src/lib/footmercatoClubSlugs.ts, api/sync-news.ts).
-- ---------------------------------------------------------------------------
create table if not exists news_items (
  id text primary key,                    -- footmercato article id
  slug text not null,
  title text not null,
  url text not null,
  image_url text,
  article_type text not null,             -- 'flash' | 'center' | ...
  published_at timestamptz not null,
  team_ids integer[] not null,
  updated_at timestamptz not null default now()
);

create index if not exists news_items_published_at_idx on news_items (published_at desc);

-- ---------------------------------------------------------------------------
-- player_stats — top scorers/assists, scraped from footmercato's ranking
-- pages (see src/lib/footmercatoStatsScraper.ts, api/sync-player-stats.ts).
-- Wiped and fully reinserted per `kind` on every sync (ranks shuffle each
-- matchday), so `id` only needs to be unique per sync run.
-- ---------------------------------------------------------------------------
create table if not exists player_stats (
  id text primary key,            -- `${kind}:${playerSlug}`
  kind text not null,             -- 'goals' | 'assists'
  rank integer not null,
  player_name text not null,
  player_slug text not null,
  player_image text,
  team_id integer references teams(id),
  team_name text not null,
  position text,
  value integer not null,         -- goal or assist count
  updated_at timestamptz not null default now()
);

create index if not exists player_stats_kind_rank_idx on player_stats (kind, rank);

-- ---------------------------------------------------------------------------
-- push_subscriptions — Web Push subscriptions for goal notifications. One
-- row per browser/device, each with its own per-competition preference
-- ('none' | 'all' | 'favorite') — see api/push-subscribe.ts,
-- src/lib/goalNotify.ts. No auth model in this app, so subscriptions aren't
-- tied to a user account; writes only ever happen through
-- api/push-subscribe.ts (service role), never directly from the client.
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  favorite_team_id integer references teams(id) on delete set null,
  pref_league text not null default 'none' check (pref_league in ('none', 'all', 'favorite')),
  pref_cup text not null default 'none' check (pref_cup in ('none', 'all', 'favorite')),
  pref_cl text not null default 'none' check (pref_cl in ('none', 'all', 'favorite')),
  pref_el text not null default 'none' check (pref_el in ('none', 'all', 'favorite')),
  pref_ecl text not null default 'none' check (pref_ecl in ('none', 'all', 'favorite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sync_logs — records each sync run for observability (requests used, success)
-- ---------------------------------------------------------------------------
create table if not exists sync_logs (
  id bigint generated always as identity primary key,
  resource text not null,                 -- 'fixtures', 'cup_fixtures', or 'european_fixtures:CL'|'EL'|'ECL'
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
alter table cup_fixtures enable row level security;
alter table european_fixtures enable row level security;
alter table news_items enable row level security;
alter table player_stats enable row level security;
alter table push_subscriptions enable row level security;
alter table sync_logs enable row level security;
alter table user_preferences enable row level security;

-- Public, read-only access for reference/content tables. All writes happen
-- server-side via the Supabase service role key (see api/sync.ts), which
-- bypasses RLS entirely, so no insert/update/delete policies are needed here.
create policy "public read teams" on teams for select using (true);
create policy "public read fixtures" on fixtures for select using (true);
create policy "public read cup_fixtures" on cup_fixtures for select using (true);
create policy "public read european_fixtures" on european_fixtures for select using (true);
create policy "public read news_items" on news_items for select using (true);
create policy "public read player_stats" on player_stats for select using (true);

-- sync_logs and push_subscriptions are operational data, not needed by the
-- client (subscriptions are written through api/push-subscribe.ts, using
-- the service role key, which bypasses RLS entirely).
create policy "service role only sync_logs" on sync_logs for all using (false);
create policy "service role only push_subscriptions" on push_subscriptions for all using (false);

-- user_preferences: authenticated users may only read/write their own row.
create policy "read own preferences" on user_preferences
  for select using (auth.uid() = id);
create policy "insert own preferences" on user_preferences
  for insert with check (auth.uid() = id);
create policy "update own preferences" on user_preferences
  for update using (auth.uid() = id);

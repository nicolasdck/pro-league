-- Top scorers / assists of the Pro League, scraped from footmercato's
-- ranking pages (no such data on TheSportsDB's free tier — see
-- src/lib/footmercatoStatsScraper.ts, api/sync-player-stats.ts). Wiped and
-- fully reinserted per `kind` on every sync (ranks shuffle each matchday),
-- so `id` only needs to be unique per sync run, not stable long-term.
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

alter table player_stats enable row level security;
create policy "public read player_stats" on player_stats for select using (true);

-- Transfer/news items aggregated from footmercato.net's per-club news API
-- (see src/lib/footmercatoClubSlugs.ts, api/sync-news.ts) across the 18 D1
-- clubs. `team_ids` lists which of those clubs the article is filed under
-- (an article can surface under more than one club, e.g. a transfer rumor
-- between two Belgian sides) — recomputed fully on every sync run, not
-- merged incrementally, since each run re-fetches all 18 club feeds anyway.
create table if not exists news_items (
  id text primary key,          -- footmercato article id
  slug text not null,
  title text not null,
  url text not null,
  image_url text,
  article_type text not null,   -- 'flash' | 'center' | ... (footmercato's own article kind)
  published_at timestamptz not null,
  team_ids integer[] not null,
  updated_at timestamptz not null default now()
);

create index if not exists news_items_published_at_idx on news_items (published_at desc);

alter table news_items enable row level security;
create policy "public read news_items" on news_items for select using (true);

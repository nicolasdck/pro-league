-- Web Push subscriptions for goal notifications. One row per browser/device
-- (the push `endpoint` is naturally unique), each with its own per-
-- competition preference — see api/push-subscribe.ts, src/lib/goalNotify.ts.
-- No auth model in this app (favorite team is just a per-browser choice),
-- so subscriptions aren't tied to a user account either; writes only ever
-- happen through api/push-subscribe.ts (service role) — never directly
-- from the client — so, like sync_logs, RLS stays enabled with no policies.
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

alter table push_subscriptions enable row level security;

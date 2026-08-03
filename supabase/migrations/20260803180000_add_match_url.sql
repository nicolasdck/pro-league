-- The footmercato detail page (buteurs, cartons) isn't fetched during sync
-- (too costly to do for every match on every cron run), only on demand when
-- a user opens a match — see api/match-events.ts. That endpoint needs the
-- per-match URL, which wasn't previously persisted.
alter table cup_fixtures add column if not exists match_url text;
alter table european_fixtures add column if not exists match_url text;

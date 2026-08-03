-- Knockout matches decided on penalties (Croky Cup from the round of 16
-- onward is single-leg; European qualifying/knockout rounds go to a
-- shootout when tied on aggregate after both legs) show a 0-0 or tied
-- scoreline without this, hiding who actually advanced.
alter table cup_fixtures add column if not exists home_penalty integer;
alter table cup_fixtures add column if not exists away_penalty integer;

alter table european_fixtures add column if not exists home_penalty integer;
alter table european_fixtures add column if not exists away_penalty integer;

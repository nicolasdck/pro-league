-- Reference colors + local logo paths for the 18 Belgian Pro League clubs
-- (2026-27 season), keyed by TheSportsDB team id.
--
-- Colors: TheSportsDB / API-Football don't expose brand colors, so this is a
-- curated lookup.
-- Logos: downloaded once into public/team-logos/ via scripts/localize-logos.mjs
-- so the app never hotlinks a third-party CDN, then shrunk into
-- public/team-logos-small/ via scripts/shrink-logos.mjs (the actual path
-- referenced below — nothing on-screen renders past 24px, see README.md).
-- Re-run both after a promotion/relegation changes the league's teams.
--
-- Safe to re-run: only touches these two columns and creates the team row if
-- it doesn't exist yet. api/sync-d1.ts never touches `logo` at all, so this
-- stays the source of truth for both.
insert into teams (id, name, primary_color, secondary_color, logo) values
  (133776, 'Anderlecht', '#582C83', '#1a1a1a', '/team-logos-small/133776.webp'),
  (134245, 'Antwerp', '#D2122E', '#0a0a0a', '/team-logos-small/134245.webp'),
  (133941, 'Beveren', '#FFD700', '#0033A0', '/team-logos-small/133941.webp'),
  (133782, 'Cercle Brugge', '#0B7A3B', '#000000', '/team-logos-small/133782.webp'),
  (133826, 'Charleroi', '#0a0a0a', '#C8102E', '/team-logos-small/133826.webp'),
  (133789, 'Club Brugge', '#0057A8', '#000000', '/team-logos-small/133789.webp'),
  (133779, 'Genk', '#00539F', '#1a1a1a', '/team-logos-small/133779.webp'),
  (133781, 'Gent', '#003DA5', '#0a0a0a', '/team-logos-small/133781.webp'),
  (133783, 'Kortrijk', '#DA291C', '#1a1a1a', '/team-logos-small/133783.webp'),
  (138143, 'Lommel', '#1C8A43', '#0a0a0a', '/team-logos-small/138143.webp'),
  (133787, 'Mechelen', '#FFD100', '#C8102E', '/team-logos-small/133787.webp'),
  (133775, 'Oud-Heverlee Leuven', '#FCD116', '#00337F', '/team-logos-small/133775.webp'),
  (148488, 'RAAL La Louvière', '#1E8449', '#0a0a0a', '/team-logos-small/148488.webp'),
  (135461, 'Sint-Truiden', '#FFD400', '#000000', '/team-logos-small/135461.webp'),
  (133778, 'Standard Liège', '#C8102E', '#000000', '/team-logos-small/133778.webp'),
  (138141, 'Union Saint-Gilloise', '#FDB913', '#002D62', '/team-logos-small/138141.webp'),
  (133790, 'Westerlo', '#F7D117', '#C8102E', '/team-logos-small/133790.webp'),
  (133786, 'Zulte Waregem', '#E30613', '#FFD100', '/team-logos-small/133786.webp')
on conflict (id) do update set
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  logo = excluded.logo;

-- The league table is now computed client-side from fixtures results
-- (see src/lib/standings.ts) instead of relying on TheSportsDB's
-- lookuptable.php, which is capped at 5 rows on the free tier.
drop table if exists standings;

import type { EuropeanCompetition } from '../types';

// Belgian clubs playing in Europe during the 2026-27 season, earned by their
// final position in the 2025-26 Pro League: Club Brugge and Union
// Saint-Gilloise reached the Champions League, Sint-Truiden and Anderlecht
// the Europa League, and Gent the Conference League. Keyed by TheSportsDB
// team id. Update this after each season once European qualification for
// the following year is confirmed.
const EUROPEAN_QUALIFICATION_2025_26 = new Map<number, EuropeanCompetition>([
  [133789, 'CL'], // Club Brugge
  [138141, 'CL'], // Union Saint-Gilloise
  [135461, 'EL'], // Sint-Truiden
  [133776, 'EL'], // Anderlecht
  [133781, 'ECL'], // Gent
]);

// Shown on both the 2025-26 final table (what that finish earned) and the
// current 2026-27 table (who's actually playing in Europe this season).
const SEASONS_SHOWING_2025_26_QUALIFICATION = new Set([2025, 2026]);

// Union Saint-Gilloise's 2025-26 finish earned a Champions League spot, but
// they were eliminated by Bodø/Glimt in the CL third qualifying round
// (aggregate 5-6, Aug 2026) and dropped straight into the Europa League
// league phase — CL Q3 losers on the Champions Path skip the EL play-off
// round entirely (confirmed via RTBF's pre-draw coverage). The 2026-27
// table should reflect where they're actually playing now; the 2025-26
// table still correctly shows CL, since that's what the finish itself
// earned regardless of the qualifying result.
const CURRENT_SEASON_OVERRIDES = new Map<number, EuropeanCompetition>([[138141, 'EL']]); // Union Saint-Gilloise

export function getEuropeanCompetition(season: number, teamId: number): EuropeanCompetition | undefined {
  if (!SEASONS_SHOWING_2025_26_QUALIFICATION.has(season)) return undefined;
  if (season === 2026) return CURRENT_SEASON_OVERRIDES.get(teamId) ?? EUROPEAN_QUALIFICATION_2025_26.get(teamId);
  return EUROPEAN_QUALIFICATION_2025_26.get(teamId);
}

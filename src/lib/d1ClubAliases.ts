// Maps the club names footmercato.net uses on match pages (often
// French/abbreviated, e.g. "Courtrai" for Kortrijk, "ZW" for Zulte Waregem)
// to the matching `teams.id` (TheSportsDB id, see supabase/seed.sql) for the
// 18 current D1 clubs. Verified against footmercato's own Pro League
// standings page (logo `alt` attributes), since calendar pages truncate
// display names but keep the full name in the logo `alt`. Shared by
// api/sync-cup.ts (Croky Cup) and api/sync-cl.ts / sync-el.ts / sync-ecl.ts
// (Champions/Europa/Conference League) — same 18-club universe either way,
// since only D1 clubs can appear in either competition.
export const D1_CLUB_ALIASES: Record<string, number> = {
	Anderlecht: 133776,
	Antwerp: 134245,
	Beveren: 133941,
	'Waasland-Beveren': 133941,
	'Cercle Bruges': 133782,
	'Cercle Brugge': 133782,
	Charleroi: 133826,
	'Sporting Charleroi': 133826,
	'Club Bruges': 133789,
	'Club Brugge': 133789,
	Courtrai: 133783,
	Kortrijk: 133783,
	Genk: 133779,
	'La Gantoise': 133781,
	Gent: 133781,
	Gand: 133781,
	'La Louvière': 148488,
	'RAAL La Louvière': 148488,
	Lommel: 138143,
	Louvain: 133775,
	'OH Louvain': 133775,
	'Oud-Heverlee Leuven': 133775,
	Malines: 133787,
	Mechelen: 133787,
	'R. Union SG': 138141,
	'Union Saint-Gilloise': 138141,
	'Saint-Trond': 135461,
	'Sint-Truiden': 135461,
	Standard: 133778,
	'Standard de Liège': 133778,
	'Standard Liège': 133778,
	Westerlo: 133790,
	ZW: 133786,
	'Zulte Waregem': 133786,
	'Zulte-Waregem': 133786,
};

export function matchD1TeamId(footmercatoName: string): number | null {
	return D1_CLUB_ALIASES[footmercatoName.trim()] ?? null;
}

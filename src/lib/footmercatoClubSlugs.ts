// Maps each D1 club's `teams.id` (TheSportsDB id, see D1_CLUB_ALIASES in
// d1ClubAliases.ts) to its footmercato.net club-page slug, used by
// api/sync-news.ts to fetch each club's news feed
// (footmercato.net/api/2.0/team/club/{slug}/news). Verified against
// footmercato's own Jupiler Pro League standings page — slugs don't
// necessarily match the display name (e.g. Gent's slug is "kaa-gent" even
// though footmercato displays it as "La Gantoise" on match cards).
export const FOOTMERCATO_CLUB_SLUGS: Record<number, string> = {
  133776: 'rsc-anderlecht', // Anderlecht
  134245: 'royal-antwerp-fc', // Antwerp
  133941: 'waasland-beveren', // Beveren
  133782: 'cercle-brugge-ksv', // Cercle Brugge
  133826: 'sporting-du-pays-de-charleroi', // Charleroi
  133789: 'club-brugge-kv', // Club Brugge
  133783: 'kv-kortrijk', // Kortrijk
  133779: 'krc-genk', // Genk
  133781: 'kaa-gent', // Gent
  148488: 'raal-la-louviere', // RAAL La Louvière
  138143: 'lommel-sk', // Lommel
  133775: 'oud-heverlee-leuven', // Oud-Heverlee Leuven
  133787: 'yr-kv-mechelen', // Mechelen
  138141: 'royal-union-saint-gilloise', // Union Saint-Gilloise
  135461: 'sint-truidense-vv', // Sint-Truiden
  133778: 'royal-standard-de-liege', // Standard Liège
  133790: 'kvc-westerlo', // Westerlo
  133786: 'sv-zulte-waregem', // Zulte Waregem
};

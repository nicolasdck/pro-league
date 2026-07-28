// Manually curated from the RBFA's official Croky Cup 2026-2027 schedule
// (https://belgianfootball.s3.eu-central-1.amazonaws.com/s3fs-public/rbfa/docs/pdf/competition/crokycup2627.pdf,
// published 24/06/2026), same spirit as historicalStandingsOverrides.ts /
// europeanQualification.ts: footmercato only publishes a match once the
// opponent is resolved (see api/sync-cup.ts), so until then this is the only
// source for "when does each D1 club enter the cup".
//
// KV Kortrijk and Lommel SK enter at the 6e tour with a fixed date (opponent
// still unknown — winner of an earlier round). The other 16 clubs enter at
// the Seizièmes de finale, whose date the RBFA lists as "TBD" — update
// `eventDate` once it's published, and drop an entry once api/sync-cup.ts
// has actually found that club's real fixture in `cup_fixtures`.
export interface CupKnownEntry {
  teamId: number;
  phase: string;
  eventDate: string | null;
}

export const CUP_KNOWN_ENTRIES: CupKnownEntry[] = [
  { teamId: 133783, phase: '6e tour', eventDate: '2026-09-27T14:00:00Z' }, // Kortrijk
  { teamId: 138143, phase: '6e tour', eventDate: '2026-09-27T14:00:00Z' }, // Lommel
  { teamId: 133776, phase: 'Seizièmes de finale', eventDate: null }, // Anderlecht
  { teamId: 134245, phase: 'Seizièmes de finale', eventDate: null }, // Antwerp
  { teamId: 133941, phase: 'Seizièmes de finale', eventDate: null }, // Beveren
  { teamId: 133782, phase: 'Seizièmes de finale', eventDate: null }, // Cercle Brugge
  { teamId: 133826, phase: 'Seizièmes de finale', eventDate: null }, // Charleroi
  { teamId: 133789, phase: 'Seizièmes de finale', eventDate: null }, // Club Brugge
  { teamId: 133779, phase: 'Seizièmes de finale', eventDate: null }, // Genk
  { teamId: 133781, phase: 'Seizièmes de finale', eventDate: null }, // Gent
  { teamId: 133787, phase: 'Seizièmes de finale', eventDate: null }, // Mechelen
  { teamId: 133775, phase: 'Seizièmes de finale', eventDate: null }, // Oud-Heverlee Leuven
  { teamId: 148488, phase: 'Seizièmes de finale', eventDate: null }, // RAAL La Louvière
  { teamId: 135461, phase: 'Seizièmes de finale', eventDate: null }, // Sint-Truiden
  { teamId: 133778, phase: 'Seizièmes de finale', eventDate: null }, // Standard Liège
  { teamId: 138141, phase: 'Seizièmes de finale', eventDate: null }, // Union Saint-Gilloise
  { teamId: 133790, phase: 'Seizièmes de finale', eventDate: null }, // Westerlo
  { teamId: 133786, phase: 'Seizièmes de finale', eventDate: null }, // Zulte Waregem
];

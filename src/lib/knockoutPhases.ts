// Client-side mirror of the ordered knockout-phase labels used server-side
// (api/sync-cup.ts's RELEVANT_PHASES, src/lib/europeSyncHandler.ts's
// PHASE_LABELS) — duplicated here rather than imported, since those files
// pull in cheerio and a Node-only fetch override that must never reach the
// browser bundle.
//
// Round-robin phases ("Phase de ligue", "Journée N") are deliberately
// excluded: a bracket only makes sense for single-elimination rounds.
export const CUP_KNOCKOUT_PHASES = [
  '6e tour',
  'Seizièmes de finale',
  'Huitièmes de finale',
  'Quarts de finale',
  'Demi-finales',
  'Finale',
];

export const EUROPEAN_KNOCKOUT_PHASES = [
  '1er tour de qualification',
  '2e tour de qualification',
  '3e tour de qualification',
  'Barrages',
  'Barrages (accès aux 8es)',
  'Huitièmes de finale',
  'Quarts de finale',
  'Demi-finales',
  'Finale',
];

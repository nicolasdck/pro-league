/** Belgian Pro League seasons are identified by their starting year (e.g. 2025 for 2025-2026) and kick off around July. */
export function currentSeason(): number {
  const now = new Date();
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/** e.g. 2023 -> "2023-24" */
export function formatSeasonLabel(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

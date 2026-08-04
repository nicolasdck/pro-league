import { isFinishedFixtureStatus, isLiveFixtureStatus, type FixtureStatus } from '../types/index.js';

// Shared by useLiveScorePolling.ts (league) and useLiveScorePollingEuro.ts
// (Cup/CL/EL/ECL) — a match can kick off a few minutes late and regularly
// runs past 90+ET with stoppage time, so the window is generous on both
// sides rather than tightly matching the nominal 90 minutes.
export const LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000;
export const LIVE_WINDOW_AFTER_MS = 130 * 60 * 1000;
export const POLL_INTERVAL_MS = 30 * 1000;

export function isWithinLiveWindow(
  status: FixtureStatus,
  eventDate: string | null,
  now: number,
): boolean {
  if (isFinishedFixtureStatus(status)) return false;
  if (isLiveFixtureStatus(status)) return true;
  if (!eventDate) return false;
  const kickoff = new Date(eventDate).getTime();
  return now >= kickoff - LIVE_WINDOW_BEFORE_MS && now <= kickoff + LIVE_WINDOW_AFTER_MS;
}

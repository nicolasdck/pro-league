import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFixtures } from './useFixtures';
import { useIsTabVisible } from './useIsTabVisible';
import { currentSeason } from '../lib/season';
import { isWithinLiveWindow, POLL_INTERVAL_MS } from '../lib/liveWindow';

// Polls api/live-scores.ts — a plain serverless function, not a cron, since
// Vercel Hobby refuses any cron more frequent than once a day. Only runs
// while at least one league fixture is plausibly live and the tab is
// visible, so an idle browser or an off day costs nothing. A successful
// poll invalidates the `fixtures` query so every already-mounted screen
// (Calendrier, Classement, l'agenda de l'équipe favorite) picks up the
// fresh score/status with no component-level changes.
export function useLiveScorePolling(): void {
  const season = currentSeason();
  const { data: fixtures } = useFixtures(season);
  const queryClient = useQueryClient();
  const isTabVisible = useIsTabVisible();

  const hasLiveCandidate = useMemo(() => {
    if (!fixtures) return false;
    const now = Date.now();
    return fixtures.some((fixture) => isWithinLiveWindow(fixture.status, fixture.eventDate, now));
  }, [fixtures]);

  useEffect(() => {
    if (!hasLiveCandidate || !isTabVisible) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch('/api/live-scores');
        if (!response.ok || cancelled) return;
        queryClient.invalidateQueries({ queryKey: ['fixtures', season] });
      } catch {
        // Best-effort — the next tick (or the daily cron, worst case) retries.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasLiveCandidate, isTabVisible, season, queryClient]);
}

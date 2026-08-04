import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCupFixtures } from './useCupFixtures';
import { useEuropeanFixtures } from './useEuropeanFixtures';
import { useIsTabVisible } from './useIsTabVisible';
import { isWithinLiveWindow, POLL_INTERVAL_MS } from '../lib/liveWindow';
import type { CupFixture, EuropeanFixture } from '../types';

// Targets matches by `match_url` rather than `id` — see the comment in
// api/live-scores-euro.ts: PostgREST serializes cup_fixtures/
// european_fixtures' bigint `id` as a bare JSON number, which silently
// loses precision in JS past 2^53 (routine for footmercato's ids), so `id`
// can't be trusted to round-trip back to the right row.
function liveMatchUrls(fixtures: Array<CupFixture | EuropeanFixture> | undefined, now: number): string[] {
  if (!fixtures) return [];
  return fixtures
    .filter((f) => f.matchUrl && isWithinLiveWindow(f.status, f.eventDate, now))
    .map((f) => f.matchUrl!);
}

async function pollTable(table: 'cup_fixtures' | 'european_fixtures', urls: string[]): Promise<boolean> {
  if (urls.length === 0) return false;
  const response = await fetch(`/api/live-scores-euro?table=${table}&urls=${encodeURIComponent(urls.join(','))}`);
  return response.ok;
}

// Same principle as useLiveScorePolling.ts (league) but for the three
// footmercato-sourced competitions: only polls api/live-scores-euro.ts
// while a Cup or CL/EL/ECL match is plausibly live and the tab is visible.
// CL/EL/ECL rows all live in the same `european_fixtures` table, so their
// URLs are combined into a single call per poll; the Cup uses its own table.
export function useLiveScorePollingEuro(): void {
  const queryClient = useQueryClient();
  const isTabVisible = useIsTabVisible();

  const cupQuery = useCupFixtures();
  const clQuery = useEuropeanFixtures('CL');
  const elQuery = useEuropeanFixtures('EL');
  const eclQuery = useEuropeanFixtures('ECL');

  const { cupUrls, europeanUrls } = useMemo(() => {
    const now = Date.now();
    return {
      cupUrls: liveMatchUrls(cupQuery.data, now),
      europeanUrls: [
        ...liveMatchUrls(clQuery.data, now),
        ...liveMatchUrls(elQuery.data, now),
        ...liveMatchUrls(eclQuery.data, now),
      ],
    };
  }, [cupQuery.data, clQuery.data, elQuery.data, eclQuery.data]);

  const hasLiveCandidate = cupUrls.length > 0 || europeanUrls.length > 0;

  useEffect(() => {
    if (!hasLiveCandidate || !isTabVisible) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const [cupUpdated, europeanUpdated] = await Promise.all([
          pollTable('cup_fixtures', cupUrls),
          pollTable('european_fixtures', europeanUrls),
        ]);
        if (cancelled) return;
        if (cupUpdated) queryClient.invalidateQueries({ queryKey: ['cup-fixtures'] });
        if (europeanUpdated) queryClient.invalidateQueries({ queryKey: ['european-fixtures'] });
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
  }, [hasLiveCandidate, isTabVisible, cupUrls, europeanUrls, queryClient]);
}

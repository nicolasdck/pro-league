import { useQuery } from '@tanstack/react-query';

export interface MatchEvent {
  minute: string;
  side: 'home' | 'away';
  player: string;
  detail: string | null;
}

export interface MatchEventsResponse {
  goals: MatchEvent[];
  yellowCards: MatchEvent[];
  redCards: MatchEvent[];
}

async function fetchMatchEvents(matchUrl: string): Promise<MatchEventsResponse> {
  const response = await fetch(`/api/match-events?url=${encodeURIComponent(matchUrl)}`);
  if (!response.ok) throw new Error(`match-events request failed (${response.status})`);
  return response.json();
}

// `enabled: false` until the caller actually expands a match card — this is
// only ever fetched on demand, never prefetched for a whole list.
export function useMatchEvents(matchUrl: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['match-events', matchUrl],
    queryFn: () => fetchMatchEvents(matchUrl!),
    enabled: enabled && !!matchUrl,
    staleTime: Infinity, // a finished match's events never change
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { mapFixture, type FixtureRow } from '../lib/mappers';
import { currentSeason } from '../lib/season';
import type { Fixture } from '../types';

async function fetchFixtures(season: number): Promise<Fixture[]> {
  const { data, error } = await supabase
    .from('fixtures')
    .select(
      '*, home_team:teams!fixtures_home_team_id_fkey(*), away_team:teams!fixtures_away_team_id_fkey(*)',
    )
    .eq('season', season)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return (data as FixtureRow[]).map(mapFixture);
}

export function useFixtures(season: number = currentSeason(), options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['fixtures', season],
    queryFn: () => fetchFixtures(season),
    staleTime: 1000 * 60 * 5,
    enabled: options?.enabled,
  });
}

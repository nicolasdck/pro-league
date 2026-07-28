import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { mapCupFixture, type CupFixtureRow } from '../lib/cupMappers';
import type { CupFixture } from '../types';

async function fetchCupFixtures(): Promise<CupFixture[]> {
  const { data, error } = await supabase
    .from('cup_fixtures')
    .select(
      '*, home_team:teams!cup_fixtures_home_team_id_fkey(*), away_team:teams!cup_fixtures_away_team_id_fkey(*)',
    )
    .order('event_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data as CupFixtureRow[]).map(mapCupFixture);
}

export function useCupFixtures() {
  return useQuery({
    queryKey: ['cup-fixtures'],
    queryFn: fetchCupFixtures,
    staleTime: 1000 * 60 * 5,
  });
}

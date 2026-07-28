import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { mapEuropeanFixture, type EuropeanFixtureRow } from '../lib/europeanMappers';
import type { EuropeanCompetition, EuropeanFixture } from '../types';

async function fetchEuropeanFixtures(competition: EuropeanCompetition): Promise<EuropeanFixture[]> {
  const { data, error } = await supabase
    .from('european_fixtures')
    .select(
      '*, home_team:teams!european_fixtures_home_team_id_fkey(*), away_team:teams!european_fixtures_away_team_id_fkey(*)',
    )
    .eq('competition', competition)
    .order('event_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data as EuropeanFixtureRow[]).map(mapEuropeanFixture);
}

export function useEuropeanFixtures(competition: EuropeanCompetition) {
  return useQuery({
    queryKey: ['european-fixtures', competition],
    queryFn: () => fetchEuropeanFixtures(competition),
    staleTime: 1000 * 60 * 5,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { mapTeam, type TeamRow } from '../lib/mappers';
import type { Team } from '../types';

async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('*').order('name');
  if (error) throw error;
  return (data as TeamRow[]).map(mapTeam);
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
    staleTime: 1000 * 60 * 60, // teams rarely change; 1h is plenty
  });
}

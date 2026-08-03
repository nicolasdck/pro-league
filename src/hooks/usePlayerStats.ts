import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { mapTeam, type TeamRow } from '../lib/mappers';
import type { PlayerStat, PlayerStatKind } from '../types';

interface PlayerStatRow {
  kind: PlayerStatKind;
  rank: number;
  player_name: string;
  player_image: string | null;
  team_id: number | null;
  team_name: string;
  position: string | null;
  value: number;
  team: TeamRow | null;
}

function mapPlayerStat(row: PlayerStatRow): PlayerStat {
  const team = row.team ? mapTeam(row.team) : null;
  return {
    kind: row.kind,
    rank: row.rank,
    playerName: row.player_name,
    playerImage: row.player_image,
    teamId: row.team_id,
    teamName: team?.name ?? row.team_name,
    teamLogo: team?.logo ?? null,
    position: row.position,
    value: row.value,
  };
}

async function fetchPlayerStats(kind: PlayerStatKind): Promise<PlayerStat[]> {
  const { data, error } = await supabase
    .from('player_stats')
    .select('*, team:teams(*)')
    .eq('kind', kind)
    .order('rank', { ascending: true });

  if (error) throw error;
  return (data as PlayerStatRow[]).map(mapPlayerStat);
}

export function usePlayerStats(kind: PlayerStatKind) {
  return useQuery({
    queryKey: ['player-stats', kind],
    queryFn: () => fetchPlayerStats(kind),
    staleTime: 1000 * 60 * 15,
  });
}

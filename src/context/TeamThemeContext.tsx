import { useEffect, useMemo, type ReactNode } from 'react';
import { useFavoriteTeam } from '../hooks/useFavoriteTeam';
import { useTeams } from '../hooks/useTeams';
import { getContrastColor } from '../lib/color';
import { TeamThemeContext } from './team-theme-context';

const DEFAULT_PRIMARY = '#6d28d9';
const DEFAULT_SECONDARY = '#1f2937';

export function TeamThemeProvider({ children }: { children: ReactNode }) {
  const { data: teams = [], isLoading: isLoadingTeams } = useTeams();
  const { favoriteTeamId, setFavoriteTeamId } = useFavoriteTeam();

  const favoriteTeam = useMemo(
    () => teams.find((team) => team.id === favoriteTeamId) ?? null,
    [teams, favoriteTeamId],
  );

  useEffect(() => {
    const root = document.documentElement;
    const primary = favoriteTeam?.primaryColor ?? DEFAULT_PRIMARY;
    const secondary = favoriteTeam?.secondaryColor ?? DEFAULT_SECONDARY;

    root.style.setProperty('--team-primary', primary);
    root.style.setProperty('--team-secondary', secondary);
    root.style.setProperty('--team-primary-fg', getContrastColor(primary));
    root.style.setProperty('--team-secondary-fg', getContrastColor(secondary));
  }, [favoriteTeam]);

  const value = useMemo(
    () => ({ teams, isLoadingTeams, favoriteTeam, favoriteTeamId, setFavoriteTeamId }),
    [teams, isLoadingTeams, favoriteTeam, favoriteTeamId, setFavoriteTeamId],
  );

  return <TeamThemeContext.Provider value={value}>{children}</TeamThemeContext.Provider>;
}

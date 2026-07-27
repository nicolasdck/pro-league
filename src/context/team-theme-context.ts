import { createContext } from 'react';
import type { Team } from '../types';

export interface TeamThemeContextValue {
  teams: Team[];
  isLoadingTeams: boolean;
  favoriteTeam: Team | null;
  favoriteTeamId: number | null;
  setFavoriteTeamId: (teamId: number | null) => void;
}

export const TeamThemeContext = createContext<TeamThemeContextValue | null>(null);

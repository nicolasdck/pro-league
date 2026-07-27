import { useContext } from 'react';
import { TeamThemeContext, type TeamThemeContextValue } from '../context/team-theme-context';

export function useTeamTheme(): TeamThemeContextValue {
  const context = useContext(TeamThemeContext);
  if (!context) throw new Error('useTeamTheme must be used within a TeamThemeProvider');
  return context;
}

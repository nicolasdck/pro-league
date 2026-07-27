import { useCallback, useState } from 'react';

const STORAGE_KEY = 'jpl-favorite-team-id';

function readStoredTeamId(): number | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function useFavoriteTeam() {
  const [favoriteTeamId, setFavoriteTeamIdState] = useState<number | null>(readStoredTeamId);

  const setFavoriteTeamId = useCallback((teamId: number | null) => {
    setFavoriteTeamIdState(teamId);
    if (teamId === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(teamId));
    }
  }, []);

  return { favoriteTeamId, setFavoriteTeamId };
}

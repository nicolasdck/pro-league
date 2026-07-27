import { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useTeamTheme } from '../hooks/useTeamTheme';

export function TeamSelector() {
  const { teams, favoriteTeam, setFavoriteTeamId } = useTeamTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-lg bg-team-secondary/10 px-3 py-1.5 text-sm font-medium text-team-secondary-fg"
      >
        {favoriteTeam?.logo ? (
          <img src={favoriteTeam.logo} alt="" className="h-5 w-5 object-contain" />
        ) : (
          <ShieldCheck className="h-5 w-5" />
        )}
        <span className="max-w-32 truncate">{favoriteTeam?.name ?? 'Choisir un club'}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fermer"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <ul className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/5 dark:bg-neutral-800">
            {teams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => {
                    setFavoriteTeamId(team.id);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
                >
                  {team.logo ? (
                    <img src={team.logo} alt="" className="h-5 w-5 object-contain" />
                  ) : (
                    <span className="h-5 w-5" />
                  )}
                  {team.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

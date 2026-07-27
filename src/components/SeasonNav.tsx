import { currentSeason, formatSeasonLabel } from '../lib/season';

interface SeasonNavProps {
  selectedSeason: number;
  onSelect: (season: number) => void;
}

export function SeasonNav({ selectedSeason, onSelect }: SeasonNavProps) {
  const current = currentSeason();
  const seasons = [current, current - 1, current - 2, current - 3];

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-900">
      {seasons.map((season) => {
        const isActive = season === selectedSeason;
        const label = season === current ? 'Actuelle' : formatSeasonLabel(season);
        return (
          <button
            key={season}
            type="button"
            onClick={() => onSelect(season)}
            className={
              isActive
                ? 'flex-1 border-t-2 border-team-primary py-2.5 text-xs font-semibold text-team-primary'
                : 'flex-1 border-t-2 border-transparent py-2.5 text-xs font-medium text-neutral-500'
            }
          >
            {label}
          </button>
        );
      })}
    </footer>
  );
}

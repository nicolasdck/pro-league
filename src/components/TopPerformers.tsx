import { useState } from 'react';
import { usePlayerStats } from '../hooks/usePlayerStats';
import type { PlayerStatKind } from '../types';

export function TopPerformers() {
  const [kind, setKind] = useState<PlayerStatKind>('goals');
  const { data: stats, isLoading, isError } = usePlayerStats(kind);

  return (
    <div className="mt-4">
      <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-xs dark:bg-neutral-800">
        <button
          type="button"
          onClick={() => setKind('goals')}
          className={
            kind === 'goals'
              ? 'flex-1 rounded-full bg-white px-2 py-1 font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
              : 'flex-1 rounded-full px-2 py-1 font-medium text-neutral-500'
          }
        >
          Buteurs
        </button>
        <button
          type="button"
          onClick={() => setKind('assists')}
          className={
            kind === 'assists'
              ? 'flex-1 rounded-full bg-white px-2 py-1 font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
              : 'flex-1 rounded-full px-2 py-1 font-medium text-neutral-500'
          }
        >
          Passeurs
        </button>
      </div>

      {isLoading && <div className="p-4 text-center text-sm text-neutral-500">Chargement…</div>}
      {isError && (
        <div className="p-4 text-center text-sm text-red-600">Impossible de charger ce classement pour le moment.</div>
      )}
      {!isLoading && !isError && stats && stats.length === 0 && (
        <div className="p-4 text-center text-sm text-neutral-500">
          Aucune donnée pour l'instant cette saison.
        </div>
      )}

      {!isLoading && !isError && stats && stats.length > 0 && (
        <div className="mt-2 flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
          {stats.map((stat) => (
            <div key={`${stat.kind}-${stat.rank}`} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-5 shrink-0 text-center text-xs text-neutral-400">{stat.rank}</span>
              {stat.playerImage && (
                <img src={stat.playerImage} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate">{stat.playerName}</div>
                <div className="flex items-center gap-1 truncate text-xs text-neutral-500">
                  {stat.teamLogo && <img src={stat.teamLogo} alt="" className="h-3.5 w-3.5 object-contain" />}
                  {stat.teamName}
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold">{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

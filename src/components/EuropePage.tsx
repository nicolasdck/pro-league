import { useState } from 'react';
import { useEuropeanFixtures } from '../hooks/useEuropeanFixtures';
import { useTeamTheme } from '../hooks/useTeamTheme';
import { MatchList } from './MatchList';
import type { EuropeanCompetition } from '../types';

const COMPETITIONS: Array<{ code: EuropeanCompetition; label: string; emptyMessage: string }> = [
  {
    code: 'CL',
    label: 'Ligue des Champions',
    emptyMessage: "Aucun club belge n'est engagé en Ligue des Champions pour l'instant.",
  },
  {
    code: 'EL',
    label: 'Europa League',
    emptyMessage: "Aucun club belge n'est engagé en Europa League pour l'instant.",
  },
  {
    code: 'ECL',
    label: 'Conference League',
    emptyMessage: "Aucun club belge n'est engagé en Conference League pour l'instant.",
  },
];

export function EuropePage() {
  const [competition, setCompetition] = useState<EuropeanCompetition>('CL');
  const active = COMPETITIONS.find((c) => c.code === competition)!;
  const { data: fixtures, isLoading, isError } = useEuropeanFixtures(competition);
  const { favoriteTeamId } = useTeamTheme();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
        {COMPETITIONS.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCompetition(c.code)}
            className={
              c.code === competition
                ? 'flex-1 rounded-full bg-white px-2 py-1.5 text-xs font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
                : 'flex-1 rounded-full px-2 py-1.5 text-xs font-medium text-neutral-500'
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="p-4 text-center text-sm text-neutral-500">Chargement…</div>}

      {isError && (
        <div className="p-4 text-center text-sm text-red-600">Impossible de charger cette compétition pour le moment.</div>
      )}

      {!isLoading && !isError && fixtures && (
        <MatchList fixtures={fixtures} favoriteTeamId={favoriteTeamId} emptyMessage={active.emptyMessage} />
      )}
    </div>
  );
}

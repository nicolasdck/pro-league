import { useMemo } from 'react';
import { useCupFixtures } from '../hooks/useCupFixtures';
import { useTeams } from '../hooks/useTeams';
import { useTeamTheme } from '../hooks/useTeamTheme';
import { CUP_KNOWN_ENTRIES, type CupKnownEntry } from '../lib/cupKnownEntries';
import { MatchList } from './MatchList';
import type { Team } from '../types';

const dayOnlyFormatter = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' });

export function CupFixturesList() {
  const { data: fixtures, isLoading: fixturesLoading, isError: fixturesError } = useCupFixtures();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { favoriteTeamId } = useTeamTheme();

  const pendingEntries = useMemo(() => {
    const teamIdsWithRealFixture = new Set(
      (fixtures ?? []).flatMap((f) => [f.homeTeam.id, f.awayTeam.id].filter((id): id is number => id !== null)),
    );
    return CUP_KNOWN_ENTRIES.filter((entry) => !teamIdsWithRealFixture.has(entry.teamId));
  }, [fixtures]);

  if (fixturesLoading || teamsLoading) {
    return <div className="p-4 text-center text-sm text-neutral-500">Chargement de la Coupe de Belgique…</div>;
  }

  if (fixturesError || !fixtures) {
    return (
      <div className="p-4 text-center text-sm text-red-600">
        Impossible de charger la Coupe de Belgique pour le moment.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingEntries.length > 0 && (
        <PendingEntriesPanel entries={pendingEntries} teams={teams ?? []} favoriteTeamId={favoriteTeamId} />
      )}
      <MatchList
        fixtures={fixtures}
        favoriteTeamId={favoriteTeamId}
        emptyMessage="Aucun club de D1 n'est encore entré en lice dans la Croky Cup."
      />
    </div>
  );
}

function PendingEntriesPanel({
  entries,
  teams,
  favoriteTeamId,
}: {
  entries: CupKnownEntry[];
  teams: Team[];
  favoriteTeamId: number | null;
}) {
  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.eventDate && b.eventDate) return a.eventDate.localeCompare(b.eventDate);
        if (a.eventDate) return -1;
        if (b.eventDate) return 1;
        const nameA = teamsById.get(a.teamId)?.name ?? '';
        const nameB = teamsById.get(b.teamId)?.name ?? '';
        return nameA.localeCompare(nameB);
      }),
    [entries, teamsById],
  );

  return (
    <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Entrée en lice prévue
      </h3>
      <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800">
        {sorted.map((entry) => {
          const team = teamsById.get(entry.teamId);
          const isFavorite = entry.teamId === favoriteTeamId;
          return (
            <div key={entry.teamId} className={`flex items-center justify-between gap-2 py-2 ${isFavorite ? 'font-semibold text-team-primary' : ''}`}>
              <div className="flex min-w-0 items-center gap-2">
                {team?.logo && <img src={team.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                <span className="truncate text-sm">{team?.name ?? `Équipe #${entry.teamId}`}</span>
              </div>
              <div className="shrink-0 text-right text-xs text-neutral-500">
                <div>{entry.phase}</div>
                <div>{entry.eventDate ? dayOnlyFormatter.format(new Date(entry.eventDate)) : 'à confirmer'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

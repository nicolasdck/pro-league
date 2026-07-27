import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFixtures } from '../hooks/useFixtures';
import { useTeamTheme } from '../hooks/useTeamTheme';
import { StatusBadge } from './StatusBadge';
import type { Fixture } from '../types';

const dateFormatter = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormatter = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

function groupByDay(fixtures: Fixture[]): Array<[string, Fixture[]]> {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = dateFormatter.format(new Date(fixture.eventDate));
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
  }
  return Array.from(groups.entries());
}

function pickDefaultRound(rounds: string[], fixtures: Fixture[]): string | undefined {
  const now = Date.now();
  const upcoming = fixtures.find((fixture) => new Date(fixture.eventDate).getTime() >= now);
  return upcoming?.round ?? rounds.at(-1);
}

export function FixturesList({ season }: { season?: number } = {}) {
  const { data: fixtures, isLoading, isError } = useFixtures(season);
  const { favoriteTeamId } = useTeamTheme();
  const [manualRound, setManualRound] = useState<string | null>(null);

  const rounds = useMemo(() => Array.from(new Set((fixtures ?? []).map((f) => f.round))), [fixtures]);
  const defaultRound = useMemo(() => pickDefaultRound(rounds, fixtures ?? []), [rounds, fixtures]);
  const selectedRound = manualRound ?? defaultRound ?? null;

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-neutral-500">Chargement du calendrier…</div>;
  }

  if (isError || !fixtures) {
    return (
      <div className="p-4 text-center text-sm text-red-600">
        Impossible de charger le calendrier pour le moment.
      </div>
    );
  }

  const roundIndex = selectedRound ? rounds.indexOf(selectedRound) : -1;
  const roundFixtures = fixtures.filter((fixture) => fixture.round === selectedRound);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          disabled={roundIndex <= 0}
          onClick={() => setManualRound(rounds[roundIndex - 1])}
          aria-label="Journée précédente"
          className="rounded-full p-2 text-team-primary disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{selectedRound ?? '—'}</span>
        <button
          type="button"
          disabled={roundIndex === -1 || roundIndex >= rounds.length - 1}
          onClick={() => setManualRound(rounds[roundIndex + 1])}
          aria-label="Journée suivante"
          className="rounded-full p-2 text-team-primary disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {groupByDay(roundFixtures).map(([day, dayFixtures]) => (
        <div key={day}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {day}
          </h3>
          <div className="flex flex-col gap-2">
            {dayFixtures.map((fixture) => {
              const involvesFavorite =
                fixture.homeTeam.id === favoriteTeamId || fixture.awayTeam.id === favoriteTeamId;
              const isPlayed = fixture.homeScore !== null && fixture.awayScore !== null;

              return (
                <div
                  key={fixture.id}
                  className={
                    involvesFavorite
                      ? 'rounded-xl border border-team-primary bg-team-primary/5 p-3 shadow-sm'
                      : 'rounded-xl border border-neutral-200 p-3 shadow-sm dark:border-neutral-800'
                  }
                >
                  <div className="mb-2 flex justify-center">
                    <StatusBadge status={fixture.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <TeamRow team={fixture.homeTeam} align="left" />
                    <div className="w-16 shrink-0 text-center text-sm font-bold">
                      {isPlayed
                        ? `${fixture.homeScore} - ${fixture.awayScore}`
                        : timeFormatter.format(new Date(fixture.eventDate))}
                    </div>
                    <TeamRow team={fixture.awayTeam} align="right" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamRow({ team, align }: { team: Fixture['homeTeam']; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {team.logo && <img src={team.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />}
      <span className="truncate text-sm">{team.name}</span>
    </div>
  );
}

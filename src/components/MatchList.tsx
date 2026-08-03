import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Tv } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { MatchOpponent } from '../types';

// Free-to-air broadcast info for an upcoming match — applies to every NS
// fixture in the list (broadcast rights are negotiated per-competition/
// per-matchday, not known match-by-match), so it's passed once from the
// caller rather than carried on MatchListFixture itself.
export interface BroadcastInfo {
  label: string;
  url: string;
}

// Structural shape shared by CupFixture and EuropeanFixture (see src/types) —
// used by both CupFixturesList and EuropePage so the phase-pagination /
// day-grouping / match-card UI is written once.
export interface MatchListFixture {
  id: string;
  phase: string;
  eventDate: string | null;
  status: 'NS' | 'FT';
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: MatchOpponent;
  awayTeam: MatchOpponent;
}

const dateFormatter = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormatter = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

function groupByDay(fixtures: MatchListFixture[]): Array<[string, MatchListFixture[]]> {
  const groups = new Map<string, MatchListFixture[]>();
  for (const fixture of fixtures) {
    const key = fixture.eventDate ? dateFormatter.format(new Date(fixture.eventDate)) : 'Date à confirmer';
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
  }
  return Array.from(groups.entries());
}

function pickDefaultPhase(phases: string[], fixtures: MatchListFixture[]): string | undefined {
  const now = Date.now();
  const upcoming = fixtures.find((fixture) => !fixture.eventDate || new Date(fixture.eventDate).getTime() >= now);
  return upcoming?.phase ?? phases.at(-1);
}

export function MatchList({
  fixtures,
  favoriteTeamId,
  emptyMessage,
  broadcast,
}: {
  fixtures: MatchListFixture[];
  favoriteTeamId: number | null;
  emptyMessage: ReactNode;
  broadcast?: BroadcastInfo;
}) {
  const [manualPhase, setManualPhase] = useState<string | null>(null);

  const phases = useMemo(() => Array.from(new Set(fixtures.map((f) => f.phase))), [fixtures]);
  const defaultPhase = useMemo(() => pickDefaultPhase(phases, fixtures), [phases, fixtures]);
  const selectedPhase = manualPhase ?? defaultPhase ?? null;

  if (fixtures.length === 0) {
    return <div className="p-4 text-center text-sm text-neutral-500">{emptyMessage}</div>;
  }

  const phaseIndex = selectedPhase ? phases.indexOf(selectedPhase) : -1;
  const phaseFixtures = fixtures.filter((fixture) => fixture.phase === selectedPhase);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          disabled={phaseIndex <= 0}
          onClick={() => setManualPhase(phases[phaseIndex - 1])}
          aria-label="Tour précédent"
          className="rounded-full p-2 text-team-primary disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{selectedPhase ?? '—'}</span>
        <button
          type="button"
          disabled={phaseIndex === -1 || phaseIndex >= phases.length - 1}
          onClick={() => setManualPhase(phases[phaseIndex + 1])}
          aria-label="Tour suivant"
          className="rounded-full p-2 text-team-primary disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {groupByDay(phaseFixtures).map(([day, dayFixtures]) => (
        <div key={day}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{day}</h3>
          <div className="flex flex-col gap-2">
            {dayFixtures.map((fixture) => {
              const involvesFavorite =
                fixture.homeTeam.id === favoriteTeamId || fixture.awayTeam.id === favoriteTeamId;
              const isPlayed = fixture.status === 'FT';

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
                    <OpponentRow opponent={fixture.homeTeam} align="left" />
                    <div className="w-16 shrink-0 text-center text-sm font-bold">
                      {isPlayed
                        ? `${fixture.homeScore} - ${fixture.awayScore}`
                        : fixture.eventDate
                          ? timeFormatter.format(new Date(fixture.eventDate))
                          : '—'}
                    </div>
                    <OpponentRow opponent={fixture.awayTeam} align="right" />
                  </div>
                  {!isPlayed && broadcast && (
                    <a
                      href={broadcast.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-team-primary hover:underline"
                    >
                      <Tv className="h-3.5 w-3.5" />
                      {broadcast.label}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OpponentRow({ opponent, align }: { opponent: MatchOpponent; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      {opponent.isD1 && opponent.logo && (
        <img src={opponent.logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
      )}
      <span className="truncate text-sm">{opponent.name}</span>
    </div>
  );
}

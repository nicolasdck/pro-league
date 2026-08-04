import { hasFixtureScore, type MatchOpponent } from '../types';
import type { MatchListFixture } from './MatchList';

const dayFormatter = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' });

// Groups a phase's fixtures into ties (aller/retour legs of the same
// pairing) using an order-independent key, so a two-legged knockout round
// renders as one bracket slot instead of two disconnected cards. Falls back
// to team name when a side has no `teams` id (foreign/non-D1 opponent).
function tieKey(fixture: MatchListFixture): string {
  const home = String(fixture.homeTeam.id ?? fixture.homeTeam.name);
  const away = String(fixture.awayTeam.id ?? fixture.awayTeam.name);
  return [home, away].sort().join('|');
}

function TeamRow({ opponent, score, isPlayed }: { opponent: MatchOpponent; score: number | null; isPlayed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="flex min-w-0 items-center gap-1">
        {opponent.isD1 && opponent.logo && (
          <img src={opponent.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
        )}
        <span className="truncate">{opponent.name}</span>
      </span>
      {isPlayed && <span className="shrink-0 font-bold">{score}</span>}
    </div>
  );
}

export function BracketView({
  fixtures,
  favoriteTeamId,
  phaseOrder,
  emptyMessage,
}: {
  fixtures: MatchListFixture[];
  favoriteTeamId: number | null;
  phaseOrder: string[];
  emptyMessage: string;
}) {
  const columns = phaseOrder
    .map((phase) => ({ phase, fixtures: fixtures.filter((f) => f.phase === phase) }))
    .filter((column) => column.fixtures.length > 0);

  if (columns.length === 0) {
    return <div className="p-4 text-center text-sm text-neutral-500">{emptyMessage}</div>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map(({ phase, fixtures: phaseFixtures }) => {
        const ties = new Map<string, MatchListFixture[]>();
        for (const fixture of phaseFixtures) {
          const key = tieKey(fixture);
          ties.set(key, [...(ties.get(key) ?? []), fixture]);
        }

        return (
          <div key={phase} className="flex w-44 shrink-0 flex-col gap-2">
            <h3 className="px-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {phase}
            </h3>
            {Array.from(ties.values()).map((legs) => {
              const sortedLegs = [...legs].sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));
              const first = sortedLegs[0];
              const involvesFavorite = sortedLegs.some(
                (leg) => leg.homeTeam.id === favoriteTeamId || leg.awayTeam.id === favoriteTeamId,
              );

              return (
                <div
                  key={first.id}
                  className={
                    involvesFavorite
                      ? 'rounded-lg border border-team-primary bg-team-primary/5 p-2 text-xs'
                      : 'rounded-lg border border-neutral-200 p-2 text-xs dark:border-neutral-800'
                  }
                >
                  {sortedLegs.map((leg, index) => {
                    const showScore = hasFixtureScore(leg.status);
                    return (
                      <div
                        key={leg.id}
                        className={
                          index > 0 ? 'mt-1.5 border-t border-neutral-100 pt-1.5 dark:border-neutral-800' : ''
                        }
                      >
                        <TeamRow opponent={leg.homeTeam} score={leg.homeScore} isPlayed={showScore} />
                        <TeamRow opponent={leg.awayTeam} score={leg.awayScore} isPlayed={showScore} />
                        {leg.status === 'FT' && leg.homePenalty !== null && leg.awayPenalty !== null && (
                          <div className="mt-0.5 text-center text-[10px] text-neutral-500">
                            {leg.homePenalty}-{leg.awayPenalty} tab
                          </div>
                        )}
                        {!showScore && leg.eventDate && (
                          <div className="mt-0.5 text-center text-[10px] text-neutral-500">
                            {dayFormatter.format(new Date(leg.eventDate))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

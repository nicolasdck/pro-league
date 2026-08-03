import { OpponentRow } from './MatchList';
import type { EuropeanFixture, EuropeanCompetition } from '../types';

const COMPETITION_LABELS: Record<EuropeanCompetition, string> = {
  CL: 'Ligue des Champions',
  EL: 'Europa League',
  ECL: 'Conference League',
};

const dateFormatter = new Intl.DateTimeFormat('fr-BE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function groupByDay(fixtures: EuropeanFixture[]): Array<[string, EuropeanFixture[]]> {
  const groups = new Map<string, EuropeanFixture[]>();
  for (const fixture of fixtures) {
    const key = fixture.eventDate ? dateFormatter.format(new Date(fixture.eventDate)) : 'Date à confirmer';
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
  }
  return Array.from(groups.entries());
}

export function EuropeHistory({
  fixtures,
  favoriteTeamId,
}: {
  fixtures: EuropeanFixture[];
  favoriteTeamId: number | null;
}) {
  const played = fixtures.filter((fixture) => fixture.status === 'FT');

  if (played.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500">
        Aucun match européen joué par un club belge pour l'instant cette saison.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupByDay(played).map(([day, dayFixtures]) => (
        <div key={day}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{day}</h3>
          <div className="flex flex-col gap-2">
            {dayFixtures.map((fixture) => {
              const involvesFavorite =
                fixture.homeTeam.id === favoriteTeamId || fixture.awayTeam.id === favoriteTeamId;

              return (
                <div
                  key={fixture.id}
                  className={
                    involvesFavorite
                      ? 'rounded-xl border border-team-primary bg-team-primary/5 p-3 shadow-sm'
                      : 'rounded-xl border border-neutral-200 p-3 shadow-sm dark:border-neutral-800'
                  }
                >
                  <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-500">
                    <span>{COMPETITION_LABELS[fixture.competition]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{fixture.phase}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <OpponentRow opponent={fixture.homeTeam} align="left" />
                    <div className="w-16 shrink-0 text-center text-sm font-bold">
                      {fixture.homeScore} - {fixture.awayScore}
                    </div>
                    <OpponentRow opponent={fixture.awayTeam} align="right" />
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

import { useState } from 'react';
import { OpponentRow } from './MatchList';
import { MatchEventsPanel } from './MatchEventsPanel';
import type { EuropeanFixture } from '../types';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
              const isExpandable = !!fixture.matchUrl;
              const isExpanded = isExpandable && expandedId === fixture.id;

              return (
                <div
                  key={fixture.id}
                  onClick={isExpandable ? () => setExpandedId(isExpanded ? null : fixture.id) : undefined}
                  role={isExpandable ? 'button' : undefined}
                  tabIndex={isExpandable ? 0 : undefined}
                  className={
                    involvesFavorite
                      ? `rounded-xl border border-team-primary bg-team-primary/5 p-3 shadow-sm ${isExpandable ? 'cursor-pointer' : ''}`
                      : `rounded-xl border border-neutral-200 p-3 shadow-sm dark:border-neutral-800 ${isExpandable ? 'cursor-pointer' : ''}`
                  }
                >
                  <div className="mb-2 flex items-center justify-center text-xs font-semibold text-neutral-500">
                    {fixture.phase}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <OpponentRow opponent={fixture.homeTeam} align="left" />
                    <div className="w-16 shrink-0 text-center text-sm font-bold">
                      {fixture.homeScore} - {fixture.awayScore}
                    </div>
                    <OpponentRow opponent={fixture.awayTeam} align="right" />
                  </div>
                  {fixture.homePenalty !== null && fixture.awayPenalty !== null && (
                    <div className="mt-1 text-center text-xs text-neutral-500">
                      {fixture.homePenalty} - {fixture.awayPenalty} tab
                    </div>
                  )}
                  {isExpanded && <MatchEventsPanel matchUrl={fixture.matchUrl} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

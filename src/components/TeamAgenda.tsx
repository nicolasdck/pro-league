import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTeamTheme } from '../hooks/useTeamTheme';
import { useTeamFixtures, COMPETITION_LABELS, type UnifiedFixture } from '../hooks/useTeamFixtures';

const dateFormatter = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' });

function isPlayed(fixture: UnifiedFixture): boolean {
  return fixture.status === 'FT' || fixture.status === 'AET' || fixture.status === 'PEN';
}

function FixtureRow({ fixture }: { fixture: UnifiedFixture }) {
  const played = isPlayed(fixture);

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-xs">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {fixture.homeLogo && <img src={fixture.homeLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />}
        <span className="truncate">{fixture.homeName}</span>
      </div>
      <div className="shrink-0 px-1 text-center font-bold">
        {played
          ? `${fixture.homeScore}-${fixture.awayScore}`
          : fixture.eventDate
            ? timeFormatter.format(new Date(fixture.eventDate))
            : '–'}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
        <span className="truncate">{fixture.awayName}</span>
        {fixture.awayLogo && <img src={fixture.awayLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />}
      </div>
    </div>
  );
}

export function TeamAgenda() {
  const { favoriteTeamId, favoriteTeam } = useTeamTheme();
  const [expanded, setExpanded] = useState(false);
  const { data: fixtures, isLoading } = useTeamFixtures(favoriteTeamId);

  if (favoriteTeamId === null || !favoriteTeam) return null;
  if (isLoading || !fixtures) return null;

  const now = Date.now();
  const nextMatch = fixtures.find((f) => !isPlayed(f) && (!f.eventDate || new Date(f.eventDate).getTime() >= now));

  return (
    <div className="border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
          <span className="shrink-0 font-semibold text-team-primary">Prochain match</span>
          {nextMatch ? (
            <span className="truncate text-neutral-600 dark:text-neutral-300">
              {COMPETITION_LABELS[nextMatch.competitionKind]} · {nextMatch.homeName} vs {nextMatch.awayName}
              {nextMatch.eventDate &&
                ` · ${dateFormatter.format(new Date(nextMatch.eventDate))} ${timeFormatter.format(new Date(nextMatch.eventDate))}`}
            </span>
          ) : (
            <span className="text-neutral-400">Aucun match à venir programmé</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 max-h-72 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
          {fixtures.length === 0 ? (
            <div className="py-2 text-center text-xs text-neutral-400">Aucun match trouvé pour ce club.</div>
          ) : (
            fixtures.map((fixture) => (
              <div key={fixture.id}>
                <div className="pt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {COMPETITION_LABELS[fixture.competitionKind]} · {fixture.round}
                </div>
                <FixtureRow fixture={fixture} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

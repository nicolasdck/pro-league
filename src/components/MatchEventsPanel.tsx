import { useMatchEvents, type MatchEvent } from '../hooks/useMatchEvents';

function GoalLine({ event }: { event: MatchEvent }) {
  return (
    <div className="truncate">
      {event.minute} {event.player}
      {event.detail && <span className="text-neutral-400"> ({event.detail})</span>}
    </div>
  );
}

function CardLine({ event, color }: { event: MatchEvent; color: 'yellow' | 'red' }) {
  return (
    <div className="flex items-center gap-1 truncate">
      <span className={`inline-block h-2.5 w-2 shrink-0 rounded-[1px] ${color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500'}`} />
      <span className="truncate">
        {event.minute} {event.player}
      </span>
    </div>
  );
}

export function MatchEventsPanel({ matchUrl }: { matchUrl: string | null }) {
  const { data, isLoading, isError } = useMatchEvents(matchUrl, true);

  if (isLoading) return <div className="mt-2 text-center text-xs text-neutral-500">Chargement du détail…</div>;
  if (isError || !data) {
    return <div className="mt-2 text-center text-xs text-red-600">Détail indisponible pour ce match.</div>;
  }

  const homeGoals = data.goals.filter((e) => e.side === 'home');
  const awayGoals = data.goals.filter((e) => e.side === 'away');
  const hasGoals = data.goals.length > 0;
  const hasCards = data.yellowCards.length > 0 || data.redCards.length > 0;

  if (!hasGoals && !hasCards) {
    return <div className="mt-2 text-center text-xs text-neutral-500">Aucun but ni carton signalé.</div>;
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800">
      {hasGoals && (
        <div>
          <div className="mb-1 text-center font-semibold uppercase tracking-wide text-neutral-500">Buts</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              {homeGoals.map((event, i) => (
                <GoalLine key={i} event={event} />
              ))}
            </div>
            <div className="flex flex-col items-end gap-0.5 text-right">
              {awayGoals.map((event, i) => (
                <GoalLine key={i} event={event} />
              ))}
            </div>
          </div>
        </div>
      )}

      {hasCards && (
        <div>
          <div className="mb-1 text-center font-semibold uppercase tracking-wide text-neutral-500">Cartons</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5">
              {data.yellowCards
                .filter((e) => e.side === 'home')
                .map((event, i) => (
                  <CardLine key={`y${i}`} event={event} color="yellow" />
                ))}
              {data.redCards
                .filter((e) => e.side === 'home')
                .map((event, i) => (
                  <CardLine key={`r${i}`} event={event} color="red" />
                ))}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              {data.yellowCards
                .filter((e) => e.side === 'away')
                .map((event, i) => (
                  <CardLine key={`y${i}`} event={event} color="yellow" />
                ))}
              {data.redCards
                .filter((e) => e.side === 'away')
                .map((event, i) => (
                  <CardLine key={`r${i}`} event={event} color="red" />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

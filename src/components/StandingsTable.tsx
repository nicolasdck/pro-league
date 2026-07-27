import { useStandings } from '../hooks/useStandings';
import { useTeamTheme } from '../hooks/useTeamTheme';
import type { EuropeanCompetition } from '../types';

const EUROPEAN_COMPETITION_LABELS: Record<EuropeanCompetition, string> = {
  CL: 'Ligue des Champions',
  EL: 'Ligue Europa',
  ECL: 'Ligue Conférence',
};

const EUROPEAN_COMPETITION_DOT: Record<EuropeanCompetition, string> = {
  CL: 'bg-blue-600',
  EL: 'bg-orange-500',
  ECL: 'bg-emerald-500',
};

export function StandingsTable({ season }: { season?: number } = {}) {
  const { data: standings, isLoading, isError } = useStandings(season);
  const { favoriteTeamId } = useTeamTheme();

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-neutral-500">Chargement du classement…</div>;
  }

  if (isError || !standings) {
    return (
      <div className="p-4 text-center text-sm text-red-600">
        Impossible de charger le classement pour le moment.
      </div>
    );
  }

  const competitionsShown = new Set(
    standings.map((standing) => standing.europeanCompetition).filter((c): c is EuropeanCompetition => !!c),
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Équipe</th>
              <th className="px-2 py-2 text-center">MJ</th>
              <th className="px-2 py-2 text-center">V</th>
              <th className="px-2 py-2 text-center">N</th>
              <th className="px-2 py-2 text-center">D</th>
              <th className="px-2 py-2 text-center">BP</th>
              <th className="px-2 py-2 text-center">BC</th>
              <th className="px-2 py-2 text-center">Diff</th>
              <th className="px-3 py-2 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const isFavorite = standing.teamId === favoriteTeamId;
              return (
                <tr
                  key={standing.teamId}
                  className={
                    isFavorite
                      ? 'border-l-4 border-team-primary bg-team-primary/10 font-semibold'
                      : 'border-b border-neutral-100 dark:border-neutral-800'
                  }
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {standing.europeanCompetition && (
                        <span
                          title={EUROPEAN_COMPETITION_LABELS[standing.europeanCompetition]}
                          className={`h-2 w-2 shrink-0 rounded-full ${EUROPEAN_COMPETITION_DOT[standing.europeanCompetition]}`}
                        />
                      )}
                      {standing.rank}
                    </div>
                  </td>
                  <td className="flex items-center gap-2 px-3 py-2">
                    {standing.team.logo && (
                      <img src={standing.team.logo} alt="" className="h-5 w-5 object-contain" />
                    )}
                    <span className="whitespace-nowrap">{standing.team.name}</span>
                  </td>
                  <td className="px-2 py-2 text-center">{standing.played}</td>
                  <td className="px-2 py-2 text-center">{standing.win}</td>
                  <td className="px-2 py-2 text-center">{standing.draw}</td>
                  <td className="px-2 py-2 text-center">{standing.lose}</td>
                  <td className="px-2 py-2 text-center">{standing.goalsFor}</td>
                  <td className="px-2 py-2 text-center">{standing.goalsAgainst}</td>
                  <td className="px-2 py-2 text-center">{standing.goalsFor - standing.goalsAgainst}</td>
                  <td className="px-3 py-2 text-center">{standing.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {competitionsShown.size > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-3 text-xs text-neutral-500">
          {(['CL', 'EL', 'ECL'] as const)
            .filter((competition) => competitionsShown.has(competition))
            .map((competition) => (
              <span key={competition} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${EUROPEAN_COMPETITION_DOT[competition]}`} />
                {EUROPEAN_COMPETITION_LABELS[competition]}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

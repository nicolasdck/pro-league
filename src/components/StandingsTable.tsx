import { useStandings } from '../hooks/useStandings';
import { useTeamTheme } from '../hooks/useTeamTheme';
import type { FormResult } from '../lib/standings';
import type { EuropeanCompetition } from '../types';

const FORM_STYLE: Record<FormResult, string> = {
  W: 'bg-emerald-500 text-white',
  D: 'bg-neutral-400 text-white',
  L: 'bg-red-500 text-white',
};

function FormBadges({ form }: { form: FormResult[] | undefined }) {
  if (!form || form.length === 0) return <span className="text-neutral-400">—</span>;
  return (
    <div className="flex justify-center gap-0.5">
      {form.map((result, index) => (
        <span
          key={index}
          className={`flex h-4 w-4 items-center justify-center rounded-[3px] text-[9px] font-bold ${FORM_STYLE[result]}`}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

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

// Live projection ("if the season ended today") of the two zones fixed by
// the Pro League's 18-club, no-playoffs format introduced in 2026-27: the
// champion plus 2nd-4th get a European ticket (proleague.be Q&R on the
// format change), and the bottom two are relegated directly (no barrage).
// Only valid for that flat round-robin format — earlier seasons used a
// Championship/Europe/Relegation playoff split that doesn't map onto a
// single table position, so this is gated to season >= 2026.
const EUROPE_ZONE_SIZE = 4;
const RELEGATION_ZONE_SIZE = 2;
const ZONE_RULES_FIRST_SEASON = 2026;

export function StandingsTable({ season }: { season?: number } = {}) {
  const { data: standings, recentForm, isLoading, isError } = useStandings(season);
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
  const zoneRulesApply = (standings[0]?.season ?? 0) >= ZONE_RULES_FIRST_SEASON;

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
              <th className="px-2 py-2 text-center">Forme</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const isFavorite = standing.teamId === favoriteTeamId;
              const isRelegationZone = zoneRulesApply && standing.rank > standings.length - RELEGATION_ZONE_SIZE;
              const isEuropeZone = zoneRulesApply && standing.rank <= EUROPE_ZONE_SIZE;

              let rowClassName = 'border-b border-neutral-100 dark:border-neutral-800';
              if (isFavorite) {
                rowClassName = 'border-l-4 border-team-primary bg-team-primary/10 font-semibold';
              } else if (isRelegationZone) {
                rowClassName = 'border-l-4 border-red-400 border-b border-neutral-100 dark:border-neutral-800';
              } else if (isEuropeZone) {
                rowClassName = 'border-l-4 border-emerald-400 border-b border-neutral-100 dark:border-neutral-800';
              }

              return (
                <tr key={standing.teamId} className={rowClassName}>
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
                  <td className="px-2 py-2 text-center">
                    <FormBadges form={recentForm.get(standing.teamId)} />
                  </td>
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

      {zoneRulesApply && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Places européennes (top {EUROPE_ZONE_SIZE})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Relégation directe
          </span>
        </div>
      )}
    </div>
  );
}

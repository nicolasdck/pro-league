import { useState } from 'react';
import { useEuropeanFixtures } from '../hooks/useEuropeanFixtures';
import { useTeamTheme } from '../hooks/useTeamTheme';
import { MatchList, type BroadcastInfo } from './MatchList';
import { EuropeHistory } from './EuropeHistory';
import { BracketView } from './BracketView';
import { EUROPEAN_KNOCKOUT_PHASES } from '../lib/knockoutPhases';
import type { EuropeanCompetition } from '../types';

// Free-to-air rights in Belgium (francophone) for European club football,
// 2026-27 season: RTBF (La Deux/Tipik + Auvio) always shows the Belgian
// club's own EL/ECL matches — our `european_fixtures` rows are exactly
// that (only Belgian-club matches are ever scraped in). RTL only airs one
// "affiche" per Champions League matchday, which isn't necessarily the
// Belgian club's game, so that link is hedged rather than a firm claim.
const BROADCAST_INFO: Record<EuropeanCompetition, BroadcastInfo> = {
  CL: { label: 'Peut-être sur RTL Play (1 affiche/journée)', url: 'https://www.rtlplay.be/rtlplay' },
  EL: { label: 'Gratuit : La Deux/Tipik (RTBF) · Auvio', url: 'https://auvio.rtbf.be/direct' },
  ECL: { label: 'Gratuit : La Deux/Tipik (RTBF) · Auvio', url: 'https://auvio.rtbf.be/direct' },
};

const COMPETITIONS: Array<{ code: EuropeanCompetition; label: string; emptyMessage: string }> = [
  {
    code: 'CL',
    label: 'Ligue des Champions',
    emptyMessage: "Aucun club belge n'est engagé en Ligue des Champions pour l'instant.",
  },
  {
    code: 'EL',
    label: 'Europa League',
    emptyMessage: "Aucun club belge n'est engagé en Europa League pour l'instant.",
  },
  {
    code: 'ECL',
    label: 'Conference League',
    emptyMessage: "Aucun club belge n'est engagé en Conference League pour l'instant.",
  },
];

type View = 'calendar' | 'history' | 'bracket';

export function EuropePage() {
  const [competition, setCompetition] = useState<EuropeanCompetition>('CL');
  const [view, setView] = useState<View>('calendar');
  const { favoriteTeamId } = useTeamTheme();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
        {COMPETITIONS.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setCompetition(c.code)}
            className={
              c.code === competition
                ? 'flex-1 rounded-full bg-white px-2 py-1.5 text-xs font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
                : 'flex-1 rounded-full px-2 py-1.5 text-xs font-medium text-neutral-500'
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-xs dark:bg-neutral-800">
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={
            view === 'calendar'
              ? 'flex-1 rounded-full bg-white px-2 py-1 font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
              : 'flex-1 rounded-full px-2 py-1 font-medium text-neutral-500'
          }
        >
          Calendrier
        </button>
        <button
          type="button"
          onClick={() => setView('history')}
          className={
            view === 'history'
              ? 'flex-1 rounded-full bg-white px-2 py-1 font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
              : 'flex-1 rounded-full px-2 py-1 font-medium text-neutral-500'
          }
        >
          Historique
        </button>
        <button
          type="button"
          onClick={() => setView('bracket')}
          className={
            view === 'bracket'
              ? 'flex-1 rounded-full bg-white px-2 py-1 font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
              : 'flex-1 rounded-full px-2 py-1 font-medium text-neutral-500'
          }
        >
          Tableau
        </button>
      </div>

      {view === 'history' && <EuropeHistorySection competition={competition} favoriteTeamId={favoriteTeamId} />}
      {view === 'bracket' && <BracketSection competition={competition} favoriteTeamId={favoriteTeamId} />}
      {view === 'calendar' && <CompetitionSection competition={competition} favoriteTeamId={favoriteTeamId} />}
    </div>
  );
}

function CompetitionSection({
  competition,
  favoriteTeamId,
}: {
  competition: EuropeanCompetition;
  favoriteTeamId: number | null;
}) {
  const active = COMPETITIONS.find((c) => c.code === competition)!;
  const { data: fixtures, isLoading, isError } = useEuropeanFixtures(competition);

  if (isLoading) return <div className="p-4 text-center text-sm text-neutral-500">Chargement…</div>;
  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-red-600">Impossible de charger cette compétition pour le moment.</div>
    );
  }
  return (
    <MatchList
      fixtures={fixtures ?? []}
      favoriteTeamId={favoriteTeamId}
      emptyMessage={active.emptyMessage}
      broadcast={BROADCAST_INFO[competition]}
    />
  );
}

function EuropeHistorySection({
  competition,
  favoriteTeamId,
}: {
  competition: EuropeanCompetition;
  favoriteTeamId: number | null;
}) {
  const { data: fixtures, isLoading, isError } = useEuropeanFixtures(competition);

  if (isLoading) return <div className="p-4 text-center text-sm text-neutral-500">Chargement…</div>;
  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-red-600">Impossible de charger l'historique pour le moment.</div>
    );
  }
  return <EuropeHistory fixtures={fixtures ?? []} favoriteTeamId={favoriteTeamId} />;
}

function BracketSection({
  competition,
  favoriteTeamId,
}: {
  competition: EuropeanCompetition;
  favoriteTeamId: number | null;
}) {
  const active = COMPETITIONS.find((c) => c.code === competition)!;
  const { data: fixtures, isLoading, isError } = useEuropeanFixtures(competition);

  if (isLoading) return <div className="p-4 text-center text-sm text-neutral-500">Chargement…</div>;
  if (isError) {
    return (
      <div className="p-4 text-center text-sm text-red-600">Impossible de charger cette compétition pour le moment.</div>
    );
  }
  return (
    <BracketView
      fixtures={fixtures ?? []}
      favoriteTeamId={favoriteTeamId}
      phaseOrder={EUROPEAN_KNOCKOUT_PHASES}
      emptyMessage={active.emptyMessage}
    />
  );
}

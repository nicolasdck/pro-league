import type { FixtureStatus } from '../types';

const LIVE_STATUSES: FixtureStatus[] = ['1H', 'HT', '2H', 'ET', 'P'];
const FINISHED_STATUSES: FixtureStatus[] = ['FT', 'AET', 'PEN'];
const DISRUPTED_STATUSES: FixtureStatus[] = ['PST', 'CANC', 'ABD', 'AWD', 'WO'];

const LABELS: Partial<Record<FixtureStatus, string>> = {
  PST: 'Reporté',
  CANC: 'Annulé',
  ABD: 'Abandonné',
  AWD: 'Forfait',
  WO: 'Forfait',
  HT: 'Mi-temps',
};

export function StatusBadge({ status }: { status: FixtureStatus }) {
  if (LIVE_STATUSES.includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-600 dark:bg-red-400" />
        {LABELS[status] ?? 'En cours'}
      </span>
    );
  }

  if (FINISHED_STATUSES.includes(status)) {
    return (
      <span className="inline-flex items-center rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
        Terminé
      </span>
    );
  }

  if (DISRUPTED_STATUSES.includes(status)) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        {LABELS[status] ?? status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-team-primary/10 px-2.5 py-0.5 text-xs font-semibold text-team-primary">
      À venir
    </span>
  );
}

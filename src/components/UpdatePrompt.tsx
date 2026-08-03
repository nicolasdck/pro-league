import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-4 bottom-16 z-50 flex items-center justify-between gap-3 rounded-xl bg-team-secondary px-4 py-3 text-team-secondary-fg shadow-lg sm:inset-x-auto sm:right-4 sm:w-96">
      <p className="text-sm">Une nouvelle version de l'app est disponible.</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="flex items-center gap-1.5 rounded-lg bg-team-primary px-3 py-1.5 text-sm font-semibold text-team-primary-fg"
        >
          <RefreshCw className="h-4 w-4" />
          Rafraîchir
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-team-secondary-fg/70 hover:text-team-secondary-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

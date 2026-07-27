import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function PWAInstallPrompt() {
  const { canInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-16 z-50 flex items-center justify-between gap-3 rounded-xl bg-team-secondary px-4 py-3 text-team-secondary-fg shadow-lg sm:inset-x-auto sm:right-4 sm:w-96">
      <p className="text-sm">Installez l'app pour un accès rapide et hors ligne.</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={promptInstall}
          className="flex items-center gap-1.5 rounded-lg bg-team-primary px-3 py-1.5 text-sm font-semibold text-team-primary-fg"
        >
          <Download className="h-4 w-4" />
          Installer
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Fermer"
          className="rounded-lg p-1.5 text-team-secondary-fg/70 hover:text-team-secondary-fg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

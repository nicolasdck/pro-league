import { X } from 'lucide-react';
import { NotificationSettings } from './NotificationSettings';

export function NotificationSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl dark:bg-neutral-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Notifications de buts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NotificationSettings />
      </div>
    </div>
  );
}

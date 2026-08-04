import { useState } from 'react';
import { usePushNotifications, type CompetitionPrefs, type NotificationPref } from '../hooks/usePushNotifications';
import { useTeamTheme } from '../hooks/useTeamTheme';

const ROWS: Array<{ key: keyof CompetitionPrefs; label: string }> = [
  { key: 'league', label: 'Championnat' },
  { key: 'cup', label: 'Coupe de Belgique' },
  { key: 'cl', label: 'Ligue des Champions' },
  { key: 'el', label: 'Europa League' },
  { key: 'ecl', label: 'Conference League' },
];

const PREF_LABELS: Record<NotificationPref, string> = {
  none: 'Rien',
  all: 'Toutes',
  favorite: 'Favorite',
};

export function NotificationSettings() {
  const { favoriteTeamId } = useTeamTheme();
  const { isSupported, prefs, isLoading, updatePrefs, unsubscribeAll } = usePushNotifications(favoriteTeamId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupported) {
    return (
      <p className="text-sm text-neutral-500">Les notifications ne sont pas prises en charge par ce navigateur.</p>
    );
  }

  const handleChange = async (key: keyof CompetitionPrefs, value: NotificationPref) => {
    setError(null);
    setPending(true);
    const next: CompetitionPrefs = { ...prefs, [key]: value };
    let ok = false;
    try {
      ok = await updatePrefs(next);
    } finally {
      setPending(false);
    }
    if (!ok) setError("Permission refusée ou erreur — les notifications n'ont pas été activées.");
  };

  const hasAnyActive = Object.values(prefs).some((value) => value !== 'none');

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Reçois une notification à chaque but, compétition par compétition. Nécessite d'autoriser les notifications
        du navigateur.
      </p>
      {favoriteTeamId === null && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          "Favorite" ne notifiera rien tant qu'aucun club favori n'est choisi en haut de l'app.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-2">
            <span className="text-sm">{row.label}</span>
            <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-xs dark:bg-neutral-800">
              {(['none', 'all', 'favorite'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={pending || isLoading}
                  onClick={() => handleChange(row.key, value)}
                  className={
                    prefs[row.key] === value
                      ? 'rounded-full bg-white px-2 py-1 font-semibold text-team-primary shadow-sm dark:bg-neutral-900'
                      : 'rounded-full px-2 py-1 font-medium text-neutral-500'
                  }
                >
                  {PREF_LABELS[value]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasAnyActive && (
        <button
          type="button"
          onClick={() => unsubscribeAll()}
          className="self-start text-xs font-medium text-red-600 hover:underline"
        >
          Se désabonner de toutes les notifications
        </button>
      )}
    </div>
  );
}

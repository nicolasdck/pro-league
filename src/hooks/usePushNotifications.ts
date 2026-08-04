import { useCallback, useEffect, useState } from 'react';

export type NotificationPref = 'none' | 'all' | 'favorite';

export interface CompetitionPrefs {
  league: NotificationPref;
  cup: NotificationPref;
  cl: NotificationPref;
  el: NotificationPref;
  ecl: NotificationPref;
}

export const DEFAULT_PREFS: CompetitionPrefs = {
  league: 'none',
  cup: 'none',
  cl: 'none',
  el: 'none',
  ecl: 'none',
};

// PushManager wants the VAPID public key as a raw Uint8Array, not the
// base64url string it's issued as.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function postSubscription(
  subscription: PushSubscription,
  favoriteTeamId: number | null,
  prefs: CompetitionPrefs,
): Promise<void> {
  const keys = subscription.toJSON().keys;
  await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, keys, favoriteTeamId, prefs }),
  });
}

// Web Push subscription + per-competition preferences ('none' | 'all' |
// 'favorite'). One subscription per browser (see api/push-subscribe.ts) —
// no login, matching the rest of the app.
export function usePushNotifications(favoriteTeamId: number | null) {
  const [isSupported] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    isSupported ? Notification.permission : 'denied',
  );
  const [prefs, setPrefs] = useState<CompetitionPrefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        const response = await fetch(`/api/push-subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`);
        if (!response.ok || cancelled) return;
        const json = (await response.json()) as {
          subscription: {
            pref_league: NotificationPref;
            pref_cup: NotificationPref;
            pref_cl: NotificationPref;
            pref_el: NotificationPref;
            pref_ecl: NotificationPref;
          } | null;
        };
        if (json.subscription && !cancelled) {
          setPrefs({
            league: json.subscription.pref_league,
            cup: json.subscription.pref_cup,
            cl: json.subscription.pref_cl,
            el: json.subscription.pref_el,
            ecl: json.subscription.pref_ecl,
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const updatePrefs = useCallback(
    async (nextPrefs: CompetitionPrefs): Promise<boolean> => {
      if (!isSupported) return false;

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      await postSubscription(subscription, favoriteTeamId, nextPrefs);
      setPrefs(nextPrefs);
      return true;
    },
    [isSupported, favoriteTeamId],
  );

  const unsubscribeAll = useCallback(async () => {
    if (!isSupported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch('/api/push-subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    setPrefs(DEFAULT_PREFS);
  }, [isSupported]);

  return { isSupported, permission, prefs, isLoading, updatePrefs, unsubscribeAll };
}

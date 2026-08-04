// Custom service worker (vite-plugin-pwa `injectManifest` strategy) —
// replaces the auto-generated one so we can handle Web Push. Everything
// generateSW used to do for us (precaching, the Supabase runtime cache) is
// reproduced by hand below with the same workbox building blocks.
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

interface CustomServiceWorkerGlobalScope extends ServiceWorkerGlobalScope {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
}

declare const self: CustomServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new StaleWhileRevalidate({
    cacheName: 'supabase-data',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

clientsClaim();

// registerType: 'prompt' (see vite.config.ts) means the waiting worker only
// activates when the user clicks "Rafraîchir" in UpdatePrompt.tsx, which
// calls updateServiceWorker(true) from virtual:pwa-register/react — that
// posts exactly this message. Without this listener the button would do
// nothing.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

interface GoalPushPayload {
  title?: string;
  body?: string;
  url?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: GoalPushPayload = {};
  try {
    payload = event.data ? (event.data.json() as GoalPushPayload) : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title ?? 'Pro League';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

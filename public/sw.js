/*
 * The one service worker (module 16): shows web push alerts and opens their link when tapped. Registered by
 * `src/lib/pushSubscribe.ts` from every app (admin, resident, platform).
 * The API sends `{ title, body, url, tag, requireInteraction }`; `url` is app-relative (`/notices/12`).
 */
const APPS = ['admin', 'resident', 'platform', 'gate'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SocietyApp', body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: data.body || '',
    data: { url: data.url || data.deepLink || null },
    requireInteraction: data.requireInteraction === true,
  };
  // One alert per `tag` (a new one with the same tag replaces the old one, and alerts again).
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(data.title || 'SocietyApp', options));
});

/** The app (`admin`, `resident`, ...) this browser registered push from: an open tab first, else what the page saved. */
async function appOf(windows) {
  for (const w of windows) {
    const first = new URL(w.url).pathname.split('/')[1];
    if (APPS.includes(first)) return first;
  }
  try {
    const hit = await (await caches.open('push-meta')).match('/push-app');
    const app = hit ? (await hit.text()).toLowerCase() : '';
    if (APPS.includes(app)) return app;
  } catch {
    /* no Cache Storage */
  }
  return 'resident';
}

/** Mirrors `linkFor` in `src/components/notifications/format.ts` for the links the API sends. */
function target(app, url) {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return `/${app}`;
  if (APPS.some(a => url === `/${a}` || url.startsWith(`/${a}/`))) return url;
  const m = /^\/(notices|surveys|emergency)\/(\d+)/.exec(url);
  if (app === 'resident') {
    if (m && m[1] === 'emergency') return '/resident/emergency-alert';
    if (m) return `/resident/${m[1]}/${m[2]}`;
    if (url === '/settings/notifications') return '/resident/notification-settings';
  }
  if (app === 'admin' && m) return `/admin/${m[1]}`;
  if (app === 'platform') return url.startsWith('/platform') ? url : '/platform/notifications';
  return `/${app}${url}`;
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const to = target(await appOf(windows), url);
      const open = windows.find(w => new URL(w.url).origin === self.location.origin);
      if (open && 'navigate' in open) {
        await open.focus();
        await open.navigate(to);
      } else await self.clients.openWindow(to);
    })(),
  );
});

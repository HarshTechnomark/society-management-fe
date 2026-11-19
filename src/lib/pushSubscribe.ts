/** Browser side of Web Push for "This device" in Settings > Notifications (spec 8.24). The service worker is `/sw.js`. */
export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  typeof Notification !== 'undefined';

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
const b64url = (buf: ArrayBuffer | null): string => {
  if (!buf) return '';
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const REFUSED_KEY = 'push-refused-at';
const DAY = 86_400_000;
/** A refusal is not asked again for 30 days (spec 11.7). */
export function refusedRecently(now = Date.now()): boolean {
  try {
    const t = Number(localStorage.getItem(REFUSED_KEY));
    return t > 0 && now - t < 30 * DAY;
  } catch {
    return false;
  }
}
export function rememberRefusal(now = Date.now()) {
  try {
    localStorage.setItem(REFUSED_KEY, String(now));
  } catch {
    /* ignore */
  }
}

/** Thrown when the person (or the browser) says no to the permission prompt. */
export class PushDeniedError extends Error {
  constructor() {
    super('Notifications are blocked in this browser. Allow them and try again.');
    this.name = 'PushDeniedError';
  }
}

/** `public/sw.js` reads this to open a tap on a push in the right app when no tab of ours is open. */
async function rememberApp(app: string) {
  try {
    await (await caches.open('push-meta')).put('/push-app', new Response(app));
  } catch {
    /* no Cache Storage here: the worker falls back to the open tab */
  }
}

/**
 * Asks permission, subscribes this browser through the one service worker (`/sw.js`) and returns the fields of
 * POST /me/push-subscriptions. `app` is the app the page runs in.
 */
export async function subscribeThisDevice(vapidPublicKey: string, app = 'RESIDENT') {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    rememberRefusal();
    throw new PushDeniedError();
  }
  await rememberApp(app);
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(vapidPublicKey),
    }));
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: b64url(sub.getKey('p256dh')), auth: b64url(sub.getKey('auth')) },
    expirationTime: sub.expirationTime,
  };
}

export async function unsubscribeThisDevice(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}

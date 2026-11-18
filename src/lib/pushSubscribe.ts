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

/** Asks permission, subscribes this browser and returns the fields of POST /me/push-subscriptions. */
export async function subscribeThisDevice(vapidPublicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error('Notifications are blocked in this browser. Allow them and try again.');
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

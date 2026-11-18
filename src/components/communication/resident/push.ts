import { residentNoticesService } from '@/services/residentNotices.service';

const KEY = 'push-refused-at';
const DAY = 86_400_000;

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** A refusal is not asked again for 30 days (spec 11.7). */
export function refusedRecently(now = Date.now()): boolean {
  try {
    const t = Number(localStorage.getItem(KEY));
    return t > 0 && now - t < 30 * DAY;
  } catch {
    return false;
  }
}
export function rememberRefusal(now = Date.now()) {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    /* ignore */
  }
}

const b64url = (buf: ArrayBuffer | null) =>
  buf
    ? btoa(String.fromCharCode(...new Uint8Array(buf)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    : '';
function keyBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Asks permission, subscribes through the page's service worker and registers the device (8.24). */
export async function registerThisDevice(): Promise<'OK' | 'DENIED' | 'NO_WORKER'> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'NO_WORKER';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'DENIED';
  const { publicKey } = await residentNoticesService.vapidKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await residentNoticesService.pushRegister({
    endpoint: sub.endpoint,
    keys: { p256dh: b64url(sub.getKey('p256dh')), auth: b64url(sub.getKey('auth')) },
    expirationTime: sub.expirationTime,
    app: 'RESIDENT',
  });
  return 'OK';
}

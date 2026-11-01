/** A grant was requested, ended or revoked in this tab: the support banner reloads its state. */
const GRANT_EVENT = 'societyapp:support-grant-changed';

export function emitGrantChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(GRANT_EVENT));
}

export function onGrantChanged(fn: () => void): () => void {
  window.addEventListener(GRANT_EVENT, fn);
  return () => window.removeEventListener(GRANT_EVENT, fn);
}

/** Society status may have changed (a 423 answer, an export request): the admin status banner reloads. */
const STATUS_EVENT = 'societyapp:society-status-changed';

export function emitStatusChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STATUS_EVENT));
}

export function onStatusChanged(fn: () => void): () => void {
  window.addEventListener(STATUS_EVENT, fn);
  return () => window.removeEventListener(STATUS_EVENT, fn);
}

import type { PublicKeyOptionsJSON } from '@/types/auth';

export const passkeysSupported = () =>
  typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials;

export function b64urlToBuffer(s: string): ArrayBuffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function bufferToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const descriptors = (list?: { id: string; type: 'public-key' }[]) =>
  list?.map(c => ({ type: c.type, id: b64urlToBuffer(c.id) }));

/** Runs `navigator.credentials.get` and returns an `AuthenticationResponseJSON`. Returns null if the user cancels. */
export async function getAssertion(options: PublicKeyOptionsJSON): Promise<Record<string, unknown> | null> {
  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        challenge: b64urlToBuffer(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification,
        allowCredentials: descriptors(options.allowCredentials),
      },
    })) as PublicKeyCredential | null;
    if (!cred) return null;
    const r = cred.response as AuthenticatorAssertionResponse;
    return {
      id: cred.id,
      rawId: bufferToB64url(cred.rawId),
      type: 'public-key',
      response: {
        clientDataJSON: bufferToB64url(r.clientDataJSON),
        authenticatorData: bufferToB64url(r.authenticatorData),
        signature: bufferToB64url(r.signature),
        userHandle: r.userHandle ? bufferToB64url(r.userHandle) : null,
      },
    };
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return null;
    throw e;
  }
}

/** Runs `navigator.credentials.create` and returns a `RegistrationResponseJSON`. Returns null if cancelled. */
export async function createCredential(
  options: PublicKeyOptionsJSON,
): Promise<Record<string, unknown> | null> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: b64urlToBuffer(options.challenge),
        rp: options.rp!,
        user: {
          id: b64urlToBuffer(options.user!.id),
          name: options.user!.name,
          displayName: options.user!.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams ?? [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        timeout: options.timeout,
        excludeCredentials: descriptors(options.excludeCredentials),
        authenticatorSelection: options.authenticatorSelection,
        attestation: options.attestation,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return null;
    const r = cred.response as AuthenticatorAttestationResponse;
    return {
      id: cred.id,
      rawId: bufferToB64url(cred.rawId),
      type: 'public-key',
      response: {
        clientDataJSON: bufferToB64url(r.clientDataJSON),
        attestationObject: bufferToB64url(r.attestationObject),
        transports: r.getTransports?.() ?? [],
      },
    };
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return null;
    throw e;
  }
}

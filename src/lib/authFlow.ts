import type { OtpChannel } from '@/types/auth';

/**
 * Short-lived sign-in state kept only in memory (never in localStorage or sessionStorage): the OTP challenge, the
 * MFA challenge token, the signup token and recovery codes. A page reload loses it and the user starts again.
 */
export interface FlowState {
  otp?: {
    challengeId: string;
    maskedMobile: string;
    channel: OtpChannel;
    resendAvailableAt: string;
    resendsLeft: number;
    purpose: 'LOGIN' | 'SIGNUP';
    mobile: string;
  };
  mfa?: { challengeToken: string; methods: string[]; expiresAt: string };
  signup?: { signupToken: string; mobile: string; expiresAt: string };
  recoveryCodes?: string[];
}

let state: FlowState = {};

export const flow = {
  get: () => state,
  set: (patch: Partial<FlowState>) => {
    state = { ...state, ...patch };
  },
  clear: (...keys: (keyof FlowState)[]) => {
    if (keys.length === 0) state = {};
    else for (const k of keys) delete state[k];
  },
};

export const REMEMBER_KEY = 'sa_remember_email';

/** "Remember my email" is the only thing this app keeps in localStorage. */
export function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? '';
  } catch {
    return '';
  }
}
export function writeRememberedEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* storage may be blocked */
  }
}

/** Only same-site relative paths are accepted as the post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}

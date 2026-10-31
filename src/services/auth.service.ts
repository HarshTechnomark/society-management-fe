/** Every module 02 network call (spec section 8). Screens import from here and never call `fetch` themselves. */
import { api, apiList } from '@/lib/apiClient';
import type {
  LinkStatus,
  Me,
  OtpChannel,
  OtpChallenge,
  Passkey,
  PublicKeyOptionsJSON,
  SecurityOverview,
  SessionRow,
  SignInResult,
  SignupVerified,
  StepUpMethod,
  TotpSetup,
} from '@/types/auth';

const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });

export const authService = {
  // sign in
  sendOtp: (mobile: string, purpose: 'LOGIN' | 'SIGNUP' = 'LOGIN', channel?: OtpChannel) =>
    post<OtpChallenge>('/auth/otp/send', { mobile, purpose, ...(channel ? { channel } : {}) }),
  resendOtp: (challengeId: string, channel?: OtpChannel) =>
    post<OtpChallenge>('/auth/otp/resend', { challengeId, ...(channel ? { channel } : {}) }),
  verifyOtp: (challengeId: string, code: string) =>
    post<SignInResult | SignupVerified>('/auth/otp/verify', { challengeId, code }),
  passwordLogin: (email: string, password: string) =>
    post<SignInResult>('/auth/password/login', { email, password }),
  passkeyOptions: () =>
    post<{ challengeId: string; publicKey: PublicKeyOptionsJSON }>('/auth/passkey/options', {}),
  passkeyVerify: (challengeId: string, credential: Record<string, unknown>) =>
    post<SignInResult>('/auth/passkey/verify', { challengeId, credential }),
  mfaVerify: (challengeToken: string, method: 'TOTP' | 'RECOVERY_CODE', code: string) =>
    post<SignInResult>('/auth/mfa/verify', { challengeToken, method, code }),
  mfaEnrollStart: (challengeToken: string) => post<TotpSetup>('/auth/mfa/enroll/start', { challengeToken }),
  mfaEnrollConfirm: (challengeToken: string, code: string) =>
    post<Extract<SignInResult, { status: 'SIGNED_IN' }> & { recoveryCodes: string[] }>(
      '/auth/mfa/enroll/confirm',
      {
        challengeToken,
        code,
      },
    ),

  // session
  me: (opts: { recover?: boolean; activity?: boolean } = {}) => api<Me>('/auth/me', opts),
  logout: () => api<null>('/auth/logout', { method: 'POST', body: {}, recover: false }),
  switchSociety: (societyId: number) => post<Me>('/auth/switch-society', { societyId }),
  updateProfile: (body: { version: number; name?: string; locale?: string }) =>
    api<Me['user']>('/auth/me', { method: 'PATCH', body }),

  // step-up
  reauthOtp: (channel?: OtpChannel) => post<OtpChallenge>('/auth/reauth/otp', channel ? { channel } : {}),
  reauthPasskeyOptions: () =>
    post<{ challengeId: string; publicKey: PublicKeyOptionsJSON }>('/auth/reauth/passkey-options', {}),
  reauth: (body: {
    method: StepUpMethod;
    code?: string;
    challengeId?: string;
    credential?: Record<string, unknown>;
  }) => post<{ authTime: string }>('/auth/reauth', body),

  // password links
  forgotPassword: (email: string) => post<null>('/auth/password/forgot', { email }),
  linkStatus: (token: string, purpose: 'PASSWORD_RESET' | 'ACCOUNT_SETUP') =>
    api<LinkStatus>('/auth/password/link-status', { query: { token, purpose } }),
  resetPassword: (token: string, password: string) => post<null>('/auth/password/reset', { token, password }),
  setupPassword: (token: string, password: string) => post<null>('/auth/password/setup', { token, password }),
  verifyEmail: (token: string) => post<{ email: string }>('/auth/email/verify', { token }),

  // my security
  security: () => api<SecurityOverview>('/me/security'),
  changePassword: (body: { currentPassword?: string; newPassword: string }) =>
    post<{ otherSessionsRevoked: number }>('/me/security/password', body),
  totpSetup: () => post<TotpSetup>('/me/security/totp/setup', {}),
  totpConfirm: (code: string) => post<{ recoveryCodes: string[] }>('/me/security/totp/confirm', { code }),
  totpOff: () => api<null>('/me/security/totp', { method: 'DELETE' }),
  newRecoveryCodes: () =>
    post<{ recoveryCodes: string[]; batchCreatedAt: string }>('/me/security/recovery-codes', {}),
  passkeys: () => api<Passkey[]>('/me/security/passkeys'),
  passkeyRegisterOptions: () =>
    post<{ challengeId: string; publicKey: PublicKeyOptionsJSON }>('/me/security/passkeys/options', {}),
  passkeyRegister: (challengeId: string, credential: Record<string, unknown>, name?: string) =>
    post<Passkey>('/me/security/passkeys', { challengeId, credential, ...(name ? { name } : {}) }),
  renamePasskey: (id: number, name: string) =>
    api<Passkey>(`/me/security/passkeys/${id}`, { method: 'PATCH', body: { name } }),
  removePasskey: (id: number) => api<null>(`/me/security/passkeys/${id}`, { method: 'DELETE' }),
  sessions: () => apiList<SessionRow>('/me/security/sessions', { query: { limit: 50 } }),
  revokeSession: (id: number) => api<null>(`/me/security/sessions/${id}`, { method: 'DELETE' }),
  revokeOthers: () => post<{ revoked: number }>('/me/security/sessions/revoke-others', {}),
  mobileStart: (newMobile: string, channel?: OtpChannel) =>
    post<OtpChallenge>('/me/security/mobile/start', { newMobile, ...(channel ? { channel } : {}) }),
  mobileConfirm: (challengeId: string, code: string) =>
    post<Me['user']>('/me/security/mobile/confirm', { challengeId, code }),
  emailChange: (newEmail: string) => post<null>('/me/security/email', { newEmail }),
  requestDeletion: (reason?: string) =>
    post<{ deletionScheduledFor: string }>('/me/security/deletion-request', {
      confirmText: 'DELETE',
      ...(reason ? { reason } : {}),
    }),
  cancelDeletion: () => api<null>('/me/security/deletion-request', { method: 'DELETE' }),
};

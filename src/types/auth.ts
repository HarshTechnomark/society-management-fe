/** Shapes of the module 02 API (spec section 8). */
export type ClientApp = 'PLATFORM' | 'ADMIN' | 'RESIDENT' | 'GATE' | 'WORK';
export type OtpChannel = 'SMS' | 'WHATSAPP';

export interface AuthUser {
  id: number;
  name: string | null;
  mobile: string | null;
  email: string | null;
  emailVerified: boolean;
  photoFileId: number | null;
  locale: string;
  status: string;
  hasPassword: boolean;
  mfaEnabled: boolean;
  mfaMandatory: boolean;
  passkeyCount: number;
  recoveryCodesRemaining: number;
  needsProfile: boolean;
  deletionScheduledFor: string | null;
  version: number;
}

export interface Membership {
  societyId: number;
  societyName: string;
  city: string | null;
  societyStatus: string;
  memberId: number | null;
  roleKey: string;
  roleName: string;
  roleScope: string;
  status: string;
  flats?: number;
}

export interface Me {
  user: AuthUser;
  session: {
    id: number;
    clientApp: ClientApp;
    authTime: string;
    idleTimeoutMinutes: number;
    stepUpMinutes: number;
    absoluteExpiresAt: string;
    amr: string[];
  };
  memberships: Membership[];
  activeSocietyId: number | null;
  needsSocietyPick: boolean;
  platformRole: string | null;
  permissions: string[];
  platformPermissions: string[];
  features: string[];
  supportGrant: { id: number; scope: string; endsAt: string } | null;
}

export interface OtpChallenge {
  challengeId: string;
  maskedMobile: string;
  channel: OtpChannel;
  expiresAt: string;
  resendAvailableAt: string;
  resendsLeft: number;
}

export type SignInResult =
  | { status: 'SIGNED_IN'; me: Me; recoveryCodes?: string[] }
  | {
      status: 'MFA_REQUIRED' | 'MFA_ENROLL_REQUIRED';
      challengeToken: string;
      methods: string[];
      expiresAt: string;
    };

export interface SignupVerified {
  status: 'SIGNUP_VERIFIED';
  signupToken: string;
  mobile: string;
  expiresAt: string;
}

export interface TotpSetup {
  secret: string;
  otpauthUri: string;
  accountLabel: string;
}

export interface Passkey {
  id: number;
  name: string;
  deviceType: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SecurityOverview {
  mobile: string | null;
  email: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  mfaEnabled: boolean;
  mfaMandatory: boolean;
  recoveryCodesRemaining: number;
  passkeys: Passkey[];
  activeSessions: number;
  deletionScheduledFor: string | null;
}

export interface SessionRow {
  id: number;
  clientApp: ClientApp;
  deviceLabel: string;
  ipLast: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface LinkStatus {
  valid: boolean;
  email?: string;
  expiresAt?: string;
  reason?: 'INVALID' | 'EXPIRED' | 'USED';
}

export type StepUpMethod = 'TOTP' | 'OTP' | 'PASSKEY';

/** WebAuthn JSON shapes used on the wire (base64url strings). */
export interface PublicKeyOptionsJSON {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: { id: string; type: 'public-key' }[];
  rp?: { id: string; name: string };
  user?: { id: string; name: string; displayName: string };
  excludeCredentials?: { id: string; type: 'public-key' }[];
  pubKeyCredParams?: { type: 'public-key'; alg: number }[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
}

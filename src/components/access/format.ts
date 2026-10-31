import { ApiError } from '@/lib/apiClient';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('');

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
export const fmtDate = (iso: string | null | undefined) => (iso ? DATE.format(new Date(iso)) : '');
export const fmtDateTime = (iso: string | null | undefined) => (iso ? DATE_TIME.format(new Date(iso)) : '');
export const lastSeen = (iso: string | null | undefined) => (iso ? fmtDateTime(iso) : 'Never');

/** Words for the module 03 error codes (spec section 12). Falls back to the API message. */
export function accessErrorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (e.code) {
    case 'LAST_CHAIRMAN':
      return 'The society needs at least one active chairman.';
    case 'LAST_SUPER_ADMIN':
      return 'At least one active Super Admin is required.';
    case 'CANNOT_GRANT_UNHELD_PERMISSION':
      return 'You cannot give a role with more access than yours.';
    case 'SELF_CHANGE_NOT_ALLOWED':
      return 'You cannot change yourself.';
    case 'CHAIRMAN_ROLE_LOCKED':
      return 'Only SocietyApp support can change the Chairman role.';
    case 'STALE_VERSION':
      return 'Someone else changed this. Reload to see their changes.';
    case 'ALREADY_MEMBER':
      return 'Already a member.';
    case 'MEMBER_SUSPENDED':
      return 'This person is suspended. Enable them instead of inviting again.';
    case 'EMAIL_IN_USE':
      return 'This email belongs to another person.';
    case 'INVITATION_ALREADY_PENDING':
      return 'Already invited. Resend instead?';
    case 'RESEND_LIMIT_REACHED':
      return 'This invitation was already sent 3 times. Revoke it and invite again.';
    case 'INVITATION_RESEND_TOO_SOON':
      return 'Wait a minute before sending it again.';
    case 'INVITATION_EXPIRED':
      return 'This invitation has expired. Ask the society to send a new one.';
    case 'INVITATION_NOT_PENDING':
      return 'This invitation was already answered or revoked.';
    case 'ROLE_IN_USE': {
      const m = e.metaNumber('memberCount');
      const p = e.metaNumber('pendingInvitationCount');
      return m !== undefined || p !== undefined
        ? `This role is still used by ${m ?? 0} member(s) and ${p ?? 0} pending invitation(s). Move them first.`
        : 'This role is still in use. Move its members first.';
    }
    case 'ROLE_NAME_TAKEN':
      return 'A role with this name already exists.';
    case 'SYSTEM_ROLE_IMMUTABLE':
      return 'System roles keep their name and cannot be deleted.';
    case 'MFA_FLAG_LOCKED':
      return 'This role holds sensitive permissions, so two-step sign-in cannot be turned off.';
    case 'GRANT_ALREADY_EXISTS':
      return 'This member already has an active extra permission for that key.';
    case 'GRANT_WINDOW_INVALID':
      return 'Pick dates within the allowed range: start within 30 days, at most 90 days long.';
    case 'EMAIL_DOMAIN_NOT_ALLOWED':
      return 'Use a SocietyApp work email address.';
    case 'USAGE_LIMIT_EXCEEDED':
      return 'Your plan limit is reached. Upgrade your plan to add more.';
    case 'PERMISSION_DENIED':
      return 'You do not have permission to do this.';
    default:
      return e.message;
  }
}

/** The text of a 400 `errors[]` entry for one field. */
export const fieldError = (e: unknown, field: string) =>
  e instanceof ApiError ? e.errors?.find(x => x.field === field)?.message : undefined;

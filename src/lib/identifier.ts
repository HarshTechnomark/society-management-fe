/** What the single sign-in box holds: an email address, a mobile number, or not enough to tell yet. */
export type IdentifierKind = 'email' | 'mobile' | 'none';

/**
 * An `@` makes it an email (the password step appears); digits, spaces, dashes and a leading `+` make it a mobile number (a code is sent
 * by SMS). Anything else, such as letters without an `@`, is not enough yet.
 */
export function identifierKind(value: string): IdentifierKind {
  const v = value.trim();
  if (!v) return 'none';
  if (v.includes('@')) return 'email';
  if (/^[+\d][\d\s-]*$/.test(v)) return 'mobile';
  return 'none';
}

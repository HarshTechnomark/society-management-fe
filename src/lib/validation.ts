/** Client-side checks that mirror the API rules (BR-02-1, BR-02-2, BR-02-13, BR-02-24). The API stays the authority. */
export function normaliseMobile(input: string): string {
  let d = input.replace(/[\s-]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  else if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return d;
}

export const isValidMobile = (input: string) => /^[6-9]\d{9}$/.test(normaliseMobile(input));

export const isValidEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const maskMobile = (m: string | null | undefined) => (m ? `${m.slice(0, 2)}XXXXX${m.slice(-3)}` : '');

/** BR-02-24: uppercase, drop spaces, add `RC-` and the middle hyphen. */
export function normaliseRecoveryCode(input: string): string {
  const raw = input.toUpperCase().replace(/[\s-]/g, '').replace(/^RC/, '');
  return raw.length === 8 ? `RC-${raw.slice(0, 4)}-${raw.slice(4)}` : input.trim().toUpperCase();
}
export const isValidRecoveryCode = (v: string) =>
  /^RC-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(normaliseRecoveryCode(v));

export type PasswordRuleKey = 'len' | 'case' | 'num' | 'sym' | 'breach' | 'email';

const COMMON = new Set([
  'password',
  'password1',
  'password@123',
  'password123',
  'qwerty123',
  'admin@123',
  'welcome@123',
  'letmein',
  'iloveyou',
  '123456789012',
  'societyapp123',
]);

export interface PasswordRule {
  key: PasswordRuleKey;
  text: string;
  ok: boolean;
}

/** The six rules of BR-02-13. The breach rule here only knows a few very common passwords; the API checks the full list. */
export function passwordRules(pw: string, email = ''): PasswordRule[] {
  const local = email.split('@')[0].toLowerCase();
  const p = pw.normalize('NFC');
  return [
    { key: 'len', text: 'At least 12 characters', ok: p.length >= 12 && p.length <= 128 },
    { key: 'case', text: 'Upper and lower case letters', ok: /\p{Ll}/u.test(p) && /\p{Lu}/u.test(p) },
    { key: 'num', text: 'A number', ok: /\d/.test(p) },
    { key: 'sym', text: 'A symbol such as @ # !', ok: /[^\p{L}\p{N}]/u.test(p) },
    {
      key: 'breach',
      text: 'Not a commonly breached password',
      ok: p.length > 0 && !COMMON.has(p.toLowerCase()),
    },
    {
      key: 'email',
      text: 'Does not contain your email name',
      ok: p.length > 0 && (local.length < 3 || !p.toLowerCase().includes(local)),
    },
  ];
}

/** 0 = empty, 1 weak, 2 fair, 3 good, 4 strong. */
export function passwordStrength(pw: string, email = ''): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  const ok = passwordRules(pw, email).filter(r => r.ok).length;
  let s = ok <= 2 ? 1 : ok <= 4 ? 2 : ok === 5 ? 3 : 4;
  if (s === 4 && pw.length < 14) s = 3;
  return s as 1 | 2 | 3 | 4;
}

export const passwordOk = (pw: string, email = '') => passwordRules(pw, email).every(r => r.ok);

/** Groups a TOTP secret in blocks of four, as the API returns it (and as users type it). */
export const groupSecret = (s: string) =>
  s
    .replace(/\s/g, '')
    .match(/.{1,4}/g)
    ?.join(' ') ?? s;

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  groupSecret,
  isValidMobile,
  isValidRecoveryCode,
  maskMobile,
  normaliseMobile,
  normaliseRecoveryCode,
  passwordOk,
  passwordRules,
  passwordStrength,
} from './validation';
import { safeNext } from './authFlow';
import { resolveClientApp } from './clientApp';

const failed = (pw: string, email = '') =>
  passwordRules(pw, email)
    .filter(r => !r.ok)
    .map(r => r.key);

describe('mobile', () => {
  it('strips spaces, hyphens, +91, 91 and a leading 0 (BR-02-1)', () => {
    for (const v of ['+91 98200 11111', '98200-11111', '919820011111', '09820011111', '9820011111'])
      expect(normaliseMobile(v)).toBe('9820011111');
  });
  it('validates 10 digits starting 6 to 9', () => {
    expect(isValidMobile('9820011111')).toBe(true);
    expect(isValidMobile('5820011111')).toBe(false);
    expect(isValidMobile('982001111')).toBe(false);
    expect(isValidMobile('98200111112')).toBe(false);
  });
  it('masks as 98XXXXX222', () => expect(maskMobile('9820011222')).toBe('98XXXXX222'));
});

describe('recovery codes (T02-05)', () => {
  it('normalises rc 7k2m q9xd', () => expect(normaliseRecoveryCode('rc 7k2m q9xd')).toBe('RC-7K2M-Q9XD'));
  it('accepts only the Crockford alphabet', () => {
    expect(isValidRecoveryCode('RC-7K2M-Q9XD')).toBe(true);
    expect(isValidRecoveryCode('7k2mq9xd')).toBe(true);
    expect(isValidRecoveryCode('RC-7K2M-Q9XU')).toBe(false);
    expect(isValidRecoveryCode('RC-7K2M')).toBe(false);
  });
});

describe('password policy (T02-01 to T02-03)', () => {
  it('Demo@Society2026 passes all rules for office@skyheights.in', () => {
    expect(failed('Demo@Society2026', 'office@skyheights.in')).toEqual([]);
    expect(passwordOk('Demo@Society2026', 'office@skyheights.in')).toBe(true);
  });
  it('Rajesh@chairman1 fails the email rule only for chairman@skyheights.in', () => {
    expect(failed('Rajesh@chairman1', 'chairman@skyheights.in')).toEqual(['email']);
  });
  it('length boundaries 11, 12, 128, 129', () => {
    const mk = (n: number) => 'Aa1@' + 'x'.repeat(n - 4);
    expect(failed(mk(11))).toContain('len');
    expect(failed(mk(12))).not.toContain('len');
    expect(failed(mk(128))).not.toContain('len');
    expect(failed(mk(129))).toContain('len');
  });
  it('flags missing classes and common passwords', () => {
    expect(failed('alllowercase12')).toEqual(expect.arrayContaining(['case', 'sym']));
    expect(failed('Password@123')).toContain('breach');
    expect(failed('NoDigitsHere@@')).toContain('num');
  });
  it('ignores a short email name (under 3 characters)', () => {
    expect(failed('Demo@Society2026', 'ab@x.in')).toEqual([]);
  });
  it('strength meter goes from empty to strong', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('a')).toBe(1);
    expect(passwordStrength('Demo@Society2026')).toBe(4);
    expect(passwordStrength('Aa1@aaaaaaaa')).toBe(3);
  });
});

describe('small helpers', () => {
  it('groups the TOTP secret in fours', () =>
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP'));
  it('formats a countdown', () => {
    expect(formatCountdown(1781)).toBe('29:41');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
  it('accepts only same-site relative next paths', () => {
    expect(safeNext('/admin/money')).toBe('/admin/money');
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil', '', null, undefined, 'admin'])
      expect(safeNext(bad)).toBeNull();
  });
  it('picks the app from the host', () => {
    expect(resolveClientApp('admin.societyapp.in')).toBe('ADMIN');
    expect(resolveClientApp('my.societyapp.in')).toBe('RESIDENT');
    expect(resolveClientApp('gate.societyapp.in')).toBe('GATE');
    expect(resolveClientApp('platform.societyapp.in')).toBe('PLATFORM');
    expect(resolveClientApp('work.societyapp.in')).toBe('WORK');
    expect(resolveClientApp('localhost:3000', '?app=gate')).toBe('GATE');
    expect(resolveClientApp('localhost:3000')).toBe('ADMIN');
  });
});

import { describe, expect, it } from 'vitest';
import { sampleMe } from '@/test/helpers';
import { ticket } from '@/test/opsFixtures';
import { actorLabel, fromIstInput, hoursMinutes, opsError, timeAgo, toIstInput } from './format';
import { visibleNav } from './PlatformShell';
import { SECURITY_KEYS, SETTINGS_TABS, fromDraft, toDraft } from './settings/fields';
import { slaLine } from './support/TicketDrawer';
import { ApiError } from '@/lib/apiClient';
import { auditRow } from '@/test/opsFixtures';

describe('time helpers', () => {
  it('words for time ago and durations', () => {
    const now = Date.parse('2026-10-30T10:00:00Z');
    expect(timeAgo('2026-10-30T09:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-10-30T07:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-10-27T10:00:00Z', now)).toBe('3 d ago');
    expect(hoursMinutes(80)).toBe('1 h 20 m');
    expect(hoursMinutes(45)).toBe('45 m');
  });

  it('converts between IST inputs and UTC instants', () => {
    // 1 Nov 10:00 IST is 04:30 UTC (spec 8.7 example).
    expect(fromIstInput('2026-11-01T10:00')).toBe('2026-11-01T04:30:00.000Z');
    expect(toIstInput('2026-11-01T04:30:00.000Z')).toBe('2026-11-01T10:00');
    expect(fromIstInput('')).toBeNull();
  });
});

describe('SLA line', () => {
  it('counts down to the first response and goes red when breached', () => {
    const now = Date.parse('2026-10-30T05:00:00Z');
    const t = ticket({
      sla: {
        ...ticket().sla,
        firstResponseDueAt: '2026-10-30T06:20:00Z',
        resolutionDueAt: '2026-10-31T04:00:00Z',
      },
    });
    expect(slaLine(t, now)).toEqual({ text: 'First response due in 1 h 20 m', breached: false });
    const late = ticket({
      sla: {
        ...ticket().sla,
        firstResponseDueAt: '2026-10-30T04:00:00Z',
        firstResponseBreachedAt: '2026-10-30T04:01:00Z',
      },
    });
    expect(slaLine(late, now)).toEqual({ text: 'First response overdue by 1 h 0 m', breached: true });
  });

  it('moves to the resolution target after the first reply and hides for resolved tickets', () => {
    const now = Date.parse('2026-10-30T05:00:00Z');
    const replied = ticket({
      sla: {
        ...ticket().sla,
        firstRespondedAt: '2026-10-30T04:30:00Z',
        resolutionDueAt: '2026-10-30T07:00:00Z',
      },
    });
    expect(slaLine(replied, now)?.text).toBe('Resolution due in 2 h 0 m');
    expect(slaLine(ticket({ status: 'RESOLVED' }), now)).toBeNull();
  });
});

describe('platform navigation', () => {
  const labels = (perms: string[]) =>
    visibleNav(sampleMe({ platformPermissions: perms })).flatMap(g => g.items.map(i => i.label));

  it('shows only what the person can open', () => {
    expect(labels([])).toEqual([]);
    expect(labels(['platform.dashboard.view', 'platform.jobs.view', 'platform.settings.view'])).toEqual([
      'Dashboard',
      'Jobs and queues',
      'Settings',
    ]);
  });

  it('opens Support for tickets or access grants', () => {
    expect(labels(['platform.support_access.view'])).toContain('Support');
    expect(labels(['platform.tickets.view'])).toContain('Support');
  });
});

describe('settings fields', () => {
  it('reads and writes each kind', () => {
    expect(toDraft('paise', 10000)).toBe('100');
    expect(fromDraft('paise', '₹100'.slice(1))).toEqual({ value: 10000 });
    expect(fromDraft('decimal', '18')).toEqual({ value: '18.0000' });
    expect(fromDraft('offsets', '7, -7, 0, 3, 3')).toEqual({ value: [-7, 0, 3, 7] });
    expect(fromDraft('offsets', 'a')).toHaveProperty('error');
    expect(fromDraft('ips', '10.0.0.0/8\n\n 203.0.113.24 ')).toEqual({
      value: ['10.0.0.0/8', '203.0.113.24'],
    });
    expect(fromDraft('int', '1.5')).toHaveProperty('error');
  });

  it('lists the spec tabs and marks the security keys', () => {
    expect(SETTINGS_TABS.map(t => t.label)).toEqual([
      'General',
      'Billing defaults',
      'Lifecycle',
      'Security',
      'Notifications',
      'Support',
      'Data',
      'Status',
    ]);
    expect(SECURITY_KEYS.has('security.ipAllowlist')).toBe(true);
    expect(SECURITY_KEYS.has('billing.sacCode')).toBe(false);
  });

  it('offers only the idle and step-up choices module 02 allows', () => {
    const sec = SETTINGS_TABS.find(t => t.id === 'security')!;
    expect(sec.fields[0].options!.map(o => o.value)).toEqual(['5', '15', '30', '60']);
    expect(sec.fields[1].options!.map(o => o.value)).toEqual(['5', '10']);
  });
});

describe('error words and audit labels', () => {
  it('maps module 07 codes to plain words', () => {
    expect(opsError(new ApiError(422, 'PUBLIC_REPLY_REQUIRED', 'x'))).toMatch(/public reply/i);
    expect(opsError(new ApiError(409, 'LAST_ENABLED_PROVIDER', 'x'))).toMatch(/last enabled/i);
    expect(opsError(new ApiError(500, 'CREDENTIALS_KEY_UNAVAILABLE', 'm', undefined, 'req_1'))).toContain(
      'req_1',
    );
  });

  it('shows platform staff as SocietyApp Support to a society', () => {
    expect(actorLabel(auditRow(), 'society')).toBe('SocietyApp Support · Platform');
    expect(actorLabel(auditRow(), 'platform')).toBe('Platform Admin');
  });
});

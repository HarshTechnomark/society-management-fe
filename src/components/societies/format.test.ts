import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { societiesService } from '@/services/societies.service';
import { routeLabel } from './admin/ReadLog';
import { grantWindow, healthBand, isValidSlug, mmss, slugify } from './format';

describe('module 05 display rules', () => {
  it('builds the slug from the name like BR-05-6 (T05-03)', () => {
    expect(slugify('Lotus Residency CHS (Phase-2)')).toBe('lotus-residency-chs-phase-2');
    expect(slugify('  Sai Krupa  ')).toBe('sai-krupa');
    expect(isValidSlug('lotus-residency')).toBe(true);
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('Lotus--x')).toBe(false);
  });

  it('uses the 75 / 55 health thresholds (spec 11.4)', () => {
    expect(healthBand(75)).toBe('HEALTHY');
    expect(healthBand(74)).toBe('WATCH');
    expect(healthBand(55)).toBe('WATCH');
    expect(healthBand(54)).toBe('AT_RISK');
    expect(healthBand(null)).toBeNull();
  });

  it('formats the grant window, countdown and read log routes', () => {
    expect(grantWindow({ startedAt: null, endsAt: null })).toBe('Not started');
    expect(
      grantWindow({ startedAt: '2026-10-30T05:42:00.000Z', endsAt: '2026-10-30T06:42:00.000Z' }),
    ).toMatch(/ to /);
    expect(mmss(125)).toBe('2:05');
    expect(routeLabel('/api/v1/billing/invoices/:id')).toBe('Billing › Invoices');
  });
});

describe('societiesService lists', () => {
  beforeEach(resetAll);

  it('reads `data: [...]` with pagination and `data: { items }` the same way', async () => {
    mockApi({
      'GET /platform/societies': [
        ok([{ id: 1 }], 'OK', { pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
        ok({ items: [{ id: 2 }], pagination: { page: 1, limit: 20, total: 9, totalPages: 1 } }),
      ],
    });
    const a = await societiesService.list();
    expect(a.data).toEqual([{ id: 1 }]);
    expect(a.pagination.total).toBe(1);
    const b = await societiesService.list();
    expect(b.data).toEqual([{ id: 2 }]);
    expect(b.pagination.total).toBe(9);
  });

  it('accepts both shapes of the current grant', async () => {
    mockApi({
      'GET /platform/support-access/current': [
        ok({ grant: { id: 5, status: 'ACTIVE' }, secondsLeft: 30 }),
        ok({ id: 6, status: 'ACTIVE', secondsLeft: 10 }),
        ok(null),
      ],
    });
    expect(await societiesService.currentGrant()).toMatchObject({ grant: { id: 5 }, secondsLeft: 30 });
    expect(await societiesService.currentGrant()).toMatchObject({ grant: { id: 6 }, secondsLeft: 10 });
    expect(await societiesService.currentGrant()).toEqual({ grant: null, secondsLeft: null });
  });
});

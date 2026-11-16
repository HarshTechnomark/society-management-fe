import { describe, expect, it } from 'vitest';
import { colRaw, reqRaw } from '@/test/collectionsFixtures';
import {
  normaliseBuildingOption,
  normaliseCollection,
  normaliseDetail,
  normaliseFund,
  normalisePagination,
  normaliseRemind,
  normaliseRequest,
  normaliseUrl,
  percentOf,
  rows,
} from './collectionsMappers';

describe('collection mappers', () => {
  it('maps a list item and computes percent when it is missing', () => {
    const c = normaliseCollection(colRaw({ percent: undefined, collectedPaise: '1825000' }));
    expect(c).toMatchObject({
      id: 12,
      status: 'PUBLISHED',
      collectedPaise: 1825000,
      percent: 25,
      isMandatory: false,
    });
    expect(normaliseCollection(colRaw({ percent: 40 })).percent).toBe(40);
  });
  it('percentOf floors, caps at 100 and survives a zero target', () => {
    expect(percentOf(199, 1000)).toBe(19);
    expect(percentOf(5000, 1000)).toBe(100);
    expect(percentOf(5, 0)).toBe(0);
  });
  it('never throws on rubbish and falls back to safe values', () => {
    const c = normaliseCollection(null);
    expect(c).toMatchObject({ id: 0, status: 'DRAFT', kind: 'OTHER', title: '' });
    expect(normaliseDetail('x').sendNotice).toBe(true);
  });
  it('maps the detail: audience, approval reason, spent', () => {
    const d = normaliseDetail(
      colRaw({
        audienceType: 'UNITS',
        audienceIds: [3, '4'],
        approval: { status: 'CHANGES_REQUESTED', reason: 'Lower the target' },
        spentPaise: 50000,
        expenses: [
          { title: 'Flowers', categoryName: 'Decor', expenseDate: '2026-11-01', amountPaise: 50000 },
        ],
      }),
    );
    expect(d.audienceIds).toEqual([3, 4]);
    expect(d.rejectedReason).toBe('Lower the target');
    expect(d.spentPaise).toBe(50000);
    expect(d.expenses[0]).toMatchObject({ category: 'Decor', date: '2026-11-01' });
    expect(normaliseDetail(colRaw()).spentPaise).toBeNull();
  });
  it('maps requests, pagination, funds, buildings, urls and reminders', () => {
    expect(normaliseRequest(reqRaw({ status: 'PART_PAID', paidPaise: '500' }))).toMatchObject({
      status: 'PART_PAID',
      paidPaise: 500,
    });
    expect(normalisePagination({ page: 2, totalPages: 0 }, 5)).toMatchObject({
      page: 2,
      total: 5,
      totalPages: 1,
    });
    expect(normaliseFund({ id: 1, name: 'Corpus', status: 'ARCHIVED' }).active).toBe(false);
    expect(normaliseFund({ id: 1, name: 'Corpus', isActive: true }).active).toBe(true);
    expect(normaliseBuildingOption({ id: 2, name: 'Tower A', unitCounts: { active: 30 } })).toEqual({
      id: 2,
      label: 'Tower A',
      count: 30,
    });
    expect(normaliseUrl({ url: 'https://x', expiresAt: 'later' })).toEqual({
      url: 'https://x',
      expiresAt: 'later',
    });
    expect(normaliseRemind({ sentTo: 32, reminderCount: 1 })).toEqual({ sentTo: 32, reminderCount: 1 });
    expect(rows({ items: [1] })).toEqual([1]);
    expect(rows(null)).toEqual([]);
  });
});

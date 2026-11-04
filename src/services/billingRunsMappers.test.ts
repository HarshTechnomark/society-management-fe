import { describe, expect, it } from 'vitest';
import {
  codeList,
  normaliseCycle,
  normaliseItem,
  normaliseRates,
  normaliseRun,
  normaliseSplitInputs,
  rateText,
  rows,
} from './billingRunsMappers';
import {
  cycleSettings,
  exceptionItemRaw,
  itemRaw,
  rulesRaw,
  runRaw,
  splitRulesRaw,
} from '@/test/billingRunsFixtures';

describe('billing run mappers', () => {
  it('maps a run with nested counts and a decimal change as text', () => {
    const r = normaliseRun(runRaw());
    expect(r).toMatchObject({
      id: 88,
      runLabel: 'BR-2026-11',
      status: 'PREVIEW',
      totalPaise: 33363100,
      changePct: 1.1613,
      isStale: false,
      version: 3,
      scopeValues: [],
    });
    expect(r.counts).toEqual({
      items: 73,
      ready: 71,
      exceptions: 0,
      excluded: 2,
      warnings: 4,
      skipped: 0,
      issued: 0,
    });
    expect(r.byHead[1]).toEqual({ headKey: 'SINKING_FUND', name: 'Sinking fund', amountPaise: 6719000 });
  });

  it('reads flat counts when the backend sends the table columns instead of a counts object', () => {
    const r = normaliseRun({ id: 1, itemCount: 5, readyCount: 4, exceptionCount: 1, issuedCount: 2 });
    expect(r.counts).toMatchObject({ items: 5, ready: 4, exceptions: 1, issued: 2 });
  });

  it('never throws on empty or odd input', () => {
    expect(normaliseRun(null).status).toBe('DRAFT');
    expect(normaliseRun({ changePct: 'abc', previousRunTotalPaise: null }).changePct).toBeNull();
    expect(normaliseItem(undefined).lines).toEqual([]);
    expect(rows({ items: [1] })).toEqual([1]);
    expect(rows(5)).toEqual([]);
  });

  it('maps an item: comma warning codes, linesSnapshot alias and decimal variance', () => {
    const i = normaliseItem(itemRaw({ warningCodes: 'LARGE_VARIANCE,PRORATED' }));
    expect(i.warningCodes).toEqual(['LARGE_VARIANCE', 'PRORATED']);
    expect(i.variancePct).toBe(1.7778);
    expect(i.lines).toHaveLength(2);
    const snap = normaliseItem({ id: 1, linesSnapshot: [{ chargeHeadKey: 'WATER', amountPaise: 5 }] });
    expect(snap.lines[0]).toMatchObject({ headKey: 'WATER', amountPaise: 5 });
    expect(normaliseItem(exceptionItemRaw()).exceptionCode).toBe('MISSING_AREA');
    expect(codeList(['A', 3, ''])).toEqual(['A']);
    expect(codeList(null)).toEqual([]);
  });

  it('describes rates in words, with a pending change', () => {
    expect(rateText({ rateType: 'PER_SQFT', ratePerSqftPaise: 320 })).toBe('₹3.20 per sq ft');
    expect(rateText({ rateType: 'FLAT_PER_UNIT', amountPaise: 90000 })).toBe('₹900 per flat');
    expect(rateText({ rateType: 'PERCENT_OF_HEADS', percent: '10.0000' })).toBe('10.0000 % of other heads');
    expect(rateText({ rateType: 'METERED' })).toBe('by meter reading');
    expect(rateText(null)).toBe('No rate set');
    const r = normaliseRates(rulesRaw());
    expect(r[0]).toMatchObject({ headName: 'Maintenance (service charges)', rateText: '₹3.20 per sq ft' });
    expect(r[0].pendingText).toBe('Waiting for approval: ₹3.50 per sq ft from 2027-04-01');
    expect(r[1].pendingText).toBeNull();
  });

  it('keeps only run-input split rules and reads the cycle setting', () => {
    expect(normaliseSplitInputs(splitRulesRaw())).toEqual([
      { id: 4, name: 'Water tanker bill', description: 'Shared by area' },
    ]);
    expect(normaliseCycle(cycleSettings('QUARTERLY'))).toBe('QUARTERLY');
    expect(normaliseCycle({ items: cycleSettings('ANNUAL') })).toBe('ANNUAL');
    expect(normaliseCycle([])).toBe('MONTHLY');
  });
});

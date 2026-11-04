import { describe, expect, it } from 'vitest';
import {
  codeList,
  mergeShortRun,
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
  splitRateRulesRaw,
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

  it('shows the rate in force on the period start, not today', () => {
    const rule = (over: object) => ({
      id: 11,
      name: 'Water',
      chargeHead: { name: 'Water' },
      scopeType: 'ALL_UNITS',
      status: 'ACTIVE',
      currentVersion: null,
      nextVersion: null,
      pendingVersion: null,
      ...over,
    });
    const water = rule({
      currentVersion: {
        rateType: 'FLAT_PER_UNIT',
        amountPaise: 35000,
        effectiveFrom: '2026-04-01',
        effectiveTo: '2026-11-30',
      },
      nextVersion: { rateType: 'FLAT_PER_UNIT', amountPaise: 40000, effectiveFrom: '2026-12-01' },
    });
    const parking = rule({
      id: 12,
      name: 'Parking',
      chargeHead: { name: 'Parking' },
      nextVersion: { rateType: 'FLAT_PER_UNIT', amountPaise: 25000, effectiveFrom: '2026-12-01' },
    });
    const dec = normaliseRates([water, parking], '2026-12-01');
    expect(dec[0].rateText).toBe('₹400 per flat from 1 Dec 2026');
    expect(dec[1].rateText).toBe('₹250 per flat from 1 Dec 2026');
    const nov = normaliseRates([water, parking], '2026-11-01');
    expect(nov[0].rateText).toBe('₹350 per flat');
    expect(nov[1].rateText).toBe('No approved rate for this period');
    // no period: today's rate
    expect(normaliseRates([water, parking])[1].rateText).toBe('No approved rate yet');
  });

  it('keeps only run-input split rules and reads the cycle setting', () => {
    expect(normaliseSplitInputs(splitRulesRaw()).map(x => x.id)).toEqual([4, 6]);
    expect(normaliseSplitInputs(splitRulesRaw(), splitRateRulesRaw(), '2026-11-01')).toEqual([
      { id: 4, name: 'Water tanker bill', description: 'Shared by area' },
    ]);
    expect(normaliseCycle(cycleSettings('QUARTERLY'))).toBe('QUARTERLY');
    expect(normaliseCycle({ items: cycleSettings('ANNUAL') })).toBe('ANNUAL');
    expect(normaliseCycle([])).toBe('MONTHLY');
  });
});

describe('real backend shapes of 11.3', () => {
  it('lists only CHARGE lines (tax and round-off lines are separate rows) and reads warningCodes null', () => {
    const i = normaliseItem(
      itemRaw({
        warningCodes: null,
        lines: [
          { lineKind: 'CHARGE', headKey: 'MAINTENANCE', description: 'Maintenance', amountPaise: 100 },
          { lineKind: 'CGST', headKey: null, description: 'CGST 9%', amountPaise: 9 },
          { lineKind: 'ROUND_OFF', headKey: null, description: 'Round off', amountPaise: -1 },
        ],
      }),
    );
    expect(i.lines).toHaveLength(1);
    expect(i.warningCodes).toEqual([]);
  });
  it('keeps the preview hash of a run in preview', () => {
    expect(normaliseRun(runRaw()).previewHash).toBe('a'.repeat(64));
    expect(normaliseRun(runRaw({ previewHash: null })).previewHash).toBeNull();
  });
  it('merges the short run answer of recompute and cancel into the run on screen', () => {
    const prev = normaliseRun(runRaw());
    const m = mergeShortRun(prev, {
      id: 88,
      runLabel: 'BR-2026-11',
      runType: 'REGULAR',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      billDate: '2026-11-01',
      status: 'DRAFT',
      version: 4,
    });
    expect(m).toMatchObject({ status: 'DRAFT', version: 4, previewHash: null, totalPaise: prev.totalPaise });
    expect(m.byHead).toHaveLength(2);
  });
});

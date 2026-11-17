import { afterEach, describe, expect, it, vi } from 'vitest';
import { fyStart } from './format';
import { todayIso } from './periods/format';
import { defaultAsOfDate, financialYearStart } from '../maintenance/ledger/format';
import { nextMonthStart } from '../maintenance/setup/format';
import { currentMonth } from '../maintenance/dues/format';

describe('date defaults follow India time', () => {
  afterEach(() => vi.useRealTimers());
  it('accounts defaults at 00:10 IST on 1 April (18:40 UTC on 31 March)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T18:40:00Z'));
    expect(todayIso()).toBe('2026-04-01');
    expect(fyStart()).toBe('2026-04-01');
    expect(financialYearStart()).toBe('2026-04-01');
    expect(currentMonth()).toBe('2026-04');
    expect(defaultAsOfDate(null)).toBe('2026-03-31');
    expect(nextMonthStart()).toBe('2026-05-01');
  });
  it('still the previous India day just before 00:00 IST', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T18:20:00Z'));
    expect(todayIso()).toBe('2026-03-31');
    expect(fyStart()).toBe('2025-04-01');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDaysIST,
  financialYearOfIST,
  financialYearStartIST,
  firstOfMonthIST,
  monthIST,
  todayIST,
} from './indiaDate';

describe('indiaDate', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the India calendar around midnight', () => {
    // 18:29 UTC = 23:59 IST, still the same day; 18:30 UTC = 00:00 IST, next day.
    expect(todayIST(new Date('2026-03-31T18:29:59Z'))).toBe('2026-03-31');
    expect(todayIST(new Date('2026-03-31T18:30:00Z'))).toBe('2026-04-01');
  });
  it('reads the mocked clock by default', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T19:00:00Z'));
    expect(todayIST()).toBe('2027-01-01');
    expect(monthIST()).toBe('2027-01');
    expect(firstOfMonthIST()).toBe('2027-01-01');
  });
  it('adds days across month and year ends', () => {
    expect(addDaysIST('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIST('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIST('2026-11-17', -29)).toBe('2026-10-19');
  });
  it('finds the financial year in India time', () => {
    expect(financialYearOfIST(new Date('2026-03-31T18:29:00Z'))).toBe(2025);
    expect(financialYearStartIST(new Date('2026-03-31T18:30:00Z'))).toBe('2026-04-01');
  });
});

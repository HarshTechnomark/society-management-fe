/**
 * Calendar days in the society's time zone (Asia/Kolkata). The API refuses dates after the society's "today" in India
 * time, so every default, max and API date parameter must come from here and not from the browser's local date.
 */
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today (or the given instant) as `YYYY-MM-DD` in India time. */
export function todayIST(now: Date = new Date()): string {
  return fmt.format(now);
}

/** A `YYYY-MM-DD` day moved by whole days (calendar arithmetic, no zone involved). */
export function addDaysIST(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** First day of the current month in India time. */
export function firstOfMonthIST(now: Date = new Date()): string {
  return todayIST(now).slice(0, 8) + '01';
}

/** `YYYY-MM` of the current month in India time. */
export function monthIST(now: Date = new Date()): string {
  return todayIST(now).slice(0, 7);
}

/** Year in which the current Indian financial year (1 April to 31 March) started. */
export function financialYearOfIST(now: Date = new Date()): number {
  const [y, m] = todayIST(now).split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

/** 1 April of the current Indian financial year. */
export function financialYearStartIST(now: Date = new Date()): string {
  return `${financialYearOfIST(now)}-04-01`;
}

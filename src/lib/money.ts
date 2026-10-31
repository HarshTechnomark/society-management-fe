/** Money is integer paise; screens show rupees with Indian digit grouping and no needless decimals. */
export function inr(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '-';
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees);
  return `${rupees < 0 ? '-' : ''}₹${Math.abs(rupees).toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "17 Nov 2026" from an ISO date or timestamp. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T23:59:59` : iso).getTime();
  return Number.isNaN(d) ? null : Math.max(0, Math.ceil((d - now) / 86_400_000));
}

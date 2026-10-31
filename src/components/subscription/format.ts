import { ApiError } from '@/lib/apiClient';
import { limitLabel } from '@/lib/limits';
import { inr } from '@/lib/money';
import type { Tone } from '@/components/ui/Chip';
import type { BillingCycle, PlanCode } from '@/types/subscriptions';

export const PLAN_CODES: PlanCode[] = ['STARTER', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];
export const PLAN_RANK: Record<string, number> = { STARTER: 1, STANDARD: 2, PREMIUM: 3, ENTERPRISE: 4 };
export const PLAN_TONE: Record<string, Tone> = {
  STARTER: 'neutral',
  STANDARD: 'info',
  PREMIUM: 'gold',
  ENTERPRISE: 'ok',
};
export const rankName = (rank: number) =>
  ({ 1: 'Starter', 2: 'Standard', 3: 'Premium', 4: 'Enterprise' })[rank] ?? String(rank);

/** "Starter to Premium", "Premium" or "Standard and Premium" for an add-on's rank range. */
export function rankRange(min: number, max: number): string {
  if (min === max) return rankName(min);
  if (max - min === 1) return `${rankName(min)} and ${rankName(max)}`;
  return `${rankName(min)} to ${rankName(max)}`;
}

/** Monthly equivalent of a price per flat (annual = (12 − free months) ÷ 12, half up), in paise. */
export function monthlyEquivalent(
  chargedFlats: number,
  pricePerFlatPaise: number,
  cycle: BillingCycle,
  annualFreeMonths: number,
): number {
  if (cycle === 'MONTHLY') return chargedFlats * pricePerFlatPaise;
  return Math.round((chargedFlats * pricePerFlatPaise * (12 - annualFreeMonths)) / 12);
}

/** Rupees typed by a person to integer paise; null when not a number with at most two decimals. */
export function rupeesToPaise(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
export const paiseToRupeesText = (paise: number) =>
  paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);

export const cycleText = (cycle: BillingCycle, freeMonths = 2) =>
  cycle === 'ANNUAL'
    ? `Annual${freeMonths > 0 ? `, ${freeMonths} month${freeMonths === 1 ? '' : 's'} free` : ''}`
    : 'Monthly';

/** "2 months free" for the annual discount column. */
export const freeMonthsText = (n: number) => (n === 0 ? 'None' : `${n} month${n === 1 ? '' : 's'} free`);

export const limitValueText = (v: number | null | undefined, key?: string) => {
  if (v === null || v === undefined) return 'Unlimited';
  if (key === 'limit.storage_gb') return `${v.toLocaleString('en-IN')} GB`;
  return v.toLocaleString('en-IN');
};

const TEXT: Record<string, string> = {
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  DRAFT_ALREADY_EXISTS: 'This plan already has a draft. Reload to open it.',
  PLAN_VERSION_NOT_DRAFT: 'This version is already published. Reload to see the latest version.',
  CATALOGUE_INCOMPLETE:
    'The draft is missing some catalogue keys. Ask engineering to run the catalogue sync.',
  PRICE_REQUIRED: 'Enter a price of at least ₹1 per flat.',
  ALWAYS_ON_FEATURE: 'Always-on features cannot be turned off.',
  PLANNED_FEATURE: 'This feature is planned and not built yet, so it cannot be turned on.',
  MIGRATION_NOTHING_TO_DO: 'No subscription is on an older version of this plan.',
  ADDON_IN_USE: 'Billing type and grants cannot change after the add-on has been bought.',
  ADDON_CODE_TAKEN: 'An add-on with this code already exists.',
  FLAG_KEY_TAKEN: 'A flag with this key already exists.',
  FLAG_ALREADY_IN_STATE: 'The flag is already in that state. Reload to see the latest.',
  FLAG_NOT_FOUND: 'This flag no longer exists.',
  SOCIETY_NOT_FOUND: 'No society with that id.',
  OVERRIDE_EXISTS: 'An active override already exists. Revoke it first.',
  SAME_PLAN: 'The society is already on this plan.',
  SAME_BILLING_CYCLE: 'That is already the billing cycle.',
  PLAN_NOT_SELF_SERVE: 'Enterprise is arranged with our sales team.',
  PLAN_INACTIVE: 'This plan is not available any more.',
  CUSTOM_PRICE_REQUIRED: 'Enterprise needs a custom price per flat.',
  CUSTOM_PRICE_NOT_ALLOWED: 'A custom price is only for Enterprise.',
  NO_PENDING_CHANGE: 'There is nothing to cancel. Reload to see the latest.',
  MIGRATION_NOT_CANCELLABLE: 'A price migration scheduled by SocietyApp cannot be cancelled here.',
  CANCEL_ALREADY_SCHEDULED: 'Cancellation is already scheduled.',
  FEATURE_TRIAL_USED: 'This feature has been trialled before.',
  FEATURE_TRIAL_ACTIVE: 'Another feature trial is running. Try again when it ends.',
  FEATURE_UNLOCK_KEY_INVALID: 'This feature cannot be unlocked or trialled on your plan.',
  FEATURE_ALREADY_INCLUDED: 'This feature is already included.',
  ADDON_NOT_ALLOWED_IN_TRIAL: 'Add-ons can be bought after the trial, once the subscription is paid.',
  ADDON_NOT_AVAILABLE_FOR_PLAN: 'This add-on is not available on your plan.',
  ADDON_NOT_ON_SALE: 'This add-on is not on sale right now.',
  ADDON_QUANTITY_EXCEEDED: 'That is more than the maximum quantity for this add-on.',
  ADDON_NOT_CANCELLABLE: 'One-time packs cannot be cancelled.',
  INVALID_STATE: 'This is not possible in the current state. Reload to see the latest.',
  SOCIETY_SUSPENDED: 'The society is suspended. Only paying to restart the plan is possible.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Reload and try again.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  PERMISSION_DENIED: 'You do not have permission to do this.',
};

/** Words for the module 04 error codes (spec section 12). Falls back to the API message and request id. */
export function subscriptionErrorText(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  if (e.code === 'DOWNGRADE_LIMIT_CONFLICT') {
    const list = (e.errors ?? [])
      .map(x => `${limitLabel(x.field)} ${x.used ?? '?'} in use, new limit ${x.targetLimit ?? '?'}`)
      .join('; ');
    return `Usage is above the new plan's limits${list ? `: ${list}` : ''}. Reduce usage first.`;
  }
  if (e.code === 'VALIDATION_FAILED' && e.errors?.length)
    return e.errors.map(x => `${x.field}: ${x.message}`).join('; ');
  const known = TEXT[e.code];
  if (known) return known;
  if (e.status >= 500 || e.code === 'INTERNAL_ERROR')
    return `Something went wrong${e.requestId ? ` (ref ${e.requestId})` : ''}.`;
  return e.message;
}

export const perFlat = (paise: number) => `${inr(paise)} / flat / month`;

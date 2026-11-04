import type { Tone } from '@/components/ui/Chip';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import type {
  CycleKey,
  GstTreatment,
  HeadType,
  PayerRouting,
  PolicyStatus,
  PolicyType,
  RateType,
  RuleVersion,
  ScopeType,
  SplitBasis,
  VersionStatus,
} from '@/types/billingSetup';

/** Words for every module 11 error code these routes can return (spec section 12). */
const TEXT: Record<string, string> = {
  VALIDATION_FAILED: 'Some details are not valid. Check the fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again to continue.',
  REAUTH_REQUIRED: 'Confirm it is you to continue.',
  FEATURE_NOT_IN_PLAN: 'This is not part of your plan. Compare plans to unlock it.',
  PERMISSION_DENIED: 'You do not have permission to change billing rules.',
  CHARGE_HEAD_NOT_FOUND: 'This charge head was not found. Reload the page.',
  RULE_NOT_FOUND: 'This billing rule was not found. Reload the page.',
  SPLIT_RULE_NOT_FOUND: 'This split rule was not found. Reload the page.',
  UNIT_NOT_FOUND: 'One of the flats was not found or is archived. Pick the flats again.',
  STALE_VERSION: 'Someone else changed this a moment ago. Reload and try again.',
  INVALID_STATE: 'This is not allowed in the current state. Reload and try again.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with different details. Try again.',
  LATE_FEE_POLICY_NOT_FOUND: 'This late fee policy was not found. Reload the page.',
  RUN_PERIOD_INVALID:
    'The date must be the first day of a billing period of your cycle (for example 1 April, 1 July for quarterly).',
  CHARGE_HEAD_KEY_TAKEN: 'A charge head with this key already exists. Pick another key.',
  CHARGE_HEAD_IN_USE:
    'A live billing rate still uses this charge head. Stop the rate with a "No charge" version first.',
  CHARGE_HEAD_ROUTING_INVALID:
    'Sinking fund, repair fund and non-occupancy heads are always billed to the owner.',
  CHARGE_HEAD_SYSTEM: 'This is a system head. Only its name, description, order and SAC code can change.',
  CHARGE_HEAD_ARCHIVED: 'This charge head is archived. Pick an active head.',
  CHARGE_HEAD_NOT_ALLOWED: 'System heads cannot be used here.',
  LEDGER_ACCOUNT_NOT_FOUND: 'This ledger account code is not in your chart of accounts.',
  RATE_TYPE_NOT_ALLOWED: 'This rate type or GST treatment is not allowed for this charge head.',
  NOC_CAP_EXCEEDED: 'Non-occupancy charges cannot be more than 10 percent of the maintenance charge.',
  METER_SOURCE_NOT_AVAILABLE: 'No meter readings are available for this meter type yet.',
  RULE_NAME_TAKEN: 'This charge head already has a rule with this name.',
  RULE_SCOPE_OVERLAP:
    'Another active rule of this head already covers some of these buildings, types or flats.',
  RULE_IN_USE:
    'This rule already has an approved rate. To stop it, add a "No charge" version instead of deleting it.',
  RULE_VERSION_PENDING: 'A rate change for this rule is already waiting for approval.',
  RULE_VERSION_DATE_TAKEN: 'An approved rate already starts on this date. Pick another date.',
  RULE_EFFECTIVE_DATE_INVALID: 'The date must be the first day of a billing period.',
  RULE_EFFECTIVE_IN_BILLED_PERIOD: 'Bills were already issued for that period. Pick a later date.',
  SPLIT_RULE_NAME_TAKEN: 'A split rule with this name already exists.',
  SPLIT_RULE_IN_USE: 'A live billing rate uses this split rule. Stop that rate first.',
  LATE_FEE_POLICY_PENDING: 'A late fee change is already waiting for approval.',
  LATE_FEE_DATE_TAKEN: 'A late fee policy already starts on this date. Pick another date.',
  APPROVAL_ALREADY_PENDING:
    'An approval request for this is already open with other details. Check approvals.',
  SOCIETY_SUSPENDED: 'The account of the society is suspended. This action is paused.',
  SOCIETY_CLOSED: 'This society is closed.',
  RATE_LIMITED: 'Too many requests. Wait a little and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
  NETWORK_ERROR: 'Cannot reach the server. Check your connection and try again.',
};
export const KNOWN_ERROR_CODES = Object.keys(TEXT);

/** The message for an error, in plain words (the API message only when the code has no text). */
export function billingSetupError(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Something went wrong. Try again.';
  return TEXT[e.code] ?? e.message;
}

/** The same error with its message in plain words, for `ErrorState` (keeps the support reference). */
export function plainError(e: unknown): unknown {
  return e instanceof ApiError
    ? new ApiError(e.status, e.code, billingSetupError(e), e.errors, e.requestId, e.retryAfterSeconds)
    : e;
}

/** The backend names a field by its API name; the forms use their own keys. */
const FIELD_ALIAS: Record<string, string> = {
  amountPaise: 'amount',
  ratePerSqftPaise: 'sqft',
  unitTypeRates: 'typeRates',
  billSplitRuleId: 'splitRuleId',
  baseChargeHeadIds: 'baseIds',
  interestRatePct: 'rate',
  flatFeePaise: 'flat',
  minChargePaise: 'minCharge',
  fixedAmountPaise: 'fixed',
  scopeType: 'scope',
  scopeValues: 'scope',
  unitIds: 'scope',
  chargeHeadId: 'head',
};

/**
 * Field errors of a 400 or 422 as `{ form key: message }`. The backend path `firstVersion.amountPaise` or
 * `unitTypeRates.2BHK` becomes the form key `amount` or `typeRates`; the first message of a key wins.
 */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError)
    for (const x of e.errors ?? []) {
      const parts = x.field.split('.').filter(p => p !== 'firstVersion' && p !== 'version' && p !== 'body');
      const head = parts[0] ?? x.field;
      out[FIELD_ALIAS[head] ?? head] ??= x.message;
    }
  return out;
}

export const opts = <T extends string>(map: Partial<Record<T, string>>) =>
  (Object.keys(map) as T[]).map(value => ({ value, label: map[value] as string }));

export const HEAD_TYPE_LABEL: Record<HeadType, string> = {
  MAINTENANCE: 'Maintenance',
  SINKING_FUND: 'Sinking fund',
  REPAIR_FUND: 'Repair fund',
  PARKING: 'Parking',
  WATER: 'Water',
  ELECTRICITY: 'Electricity',
  NON_OCCUPANCY: 'Non-occupancy',
  FESTIVAL: 'Festival',
  COLLECTION: 'Collection',
  BOUNCE_CHARGE: 'Bounce charge',
  MEMBERSHIP: 'Membership',
  DEPOSIT: 'Deposit',
  AMENITY: 'Amenity',
  FINE: 'Fine',
  SERVICE: 'Service',
  TRANSFER: 'Transfer',
  INTEREST: 'Interest',
  LATE_FEE: 'Late fee',
  OPENING_ARREARS: 'Opening arrears',
  OTHER: 'Other',
};
/** Types a user can pick when creating a head (the three system types are seeded only). */
export const CREATABLE_HEAD_TYPES = (Object.keys(HEAD_TYPE_LABEL) as HeadType[]).filter(
  t => t !== 'INTEREST' && t !== 'LATE_FEE' && t !== 'OPENING_ARREARS',
);
/** Heads of these types are the member's own obligation and must be billed to the owner (BR-11-9). */
export const OWNER_ONLY_TYPES: HeadType[] = ['SINKING_FUND', 'REPAIR_FUND', 'NON_OCCUPANCY'];

export const ROUTING_LABEL: Record<PayerRouting, string> = {
  OWNER: 'Owner',
  BILL_TO: 'Bill-to party (owner or paying tenant)',
};
export const ROUTING_SHORT: Record<PayerRouting, string> = { OWNER: 'Owner', BILL_TO: 'Bill-to' };
export const GST_LABEL: Record<GstTreatment, string> = {
  NONE: 'No GST',
  THRESHOLD: 'Counts toward the ₹7,500 limit',
  ALWAYS: 'Always taxed',
  FOLLOW_SOURCE: 'Follows the bill it arises from',
};
export const GST_SHORT: Record<GstTreatment, string> = {
  NONE: 'None',
  THRESHOLD: 'Threshold',
  ALWAYS: 'Always',
  FOLLOW_SOURCE: 'Follows bill',
};

export const SCOPE_LABEL: Record<ScopeType, string> = {
  ALL_UNITS: 'All flats',
  BUILDINGS: 'Selected buildings',
  UNIT_TYPES: 'Selected flat types',
  UNITS: 'Selected flats (override or exemption)',
};
/** The values of module 08 `unitType` and the usual `bhk` values a rule can name. */
export const UNIT_TYPE_VALUES = [
  'FLAT',
  'SHOP',
  'OFFICE',
  'PARKING_ONLY',
  '1RK',
  '1BHK',
  '2BHK',
  '3BHK',
  '4BHK',
  '5BHK',
];

export const RATE_LABEL: Record<RateType, string> = {
  FLAT_PER_UNIT: 'Flat amount per flat',
  PER_SQFT: 'Per square foot',
  PER_UNIT_TYPE: 'Per flat type',
  METERED: 'Metered (slabs)',
  SPLIT_TOTAL: 'Share of a total (split rule)',
  PERCENT_OF_HEADS: 'Percent of other heads',
  NONE: 'No charge (stops the head)',
};

export const CYCLE_LABEL: Record<CycleKey, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  ANNUAL: 'Annual',
};
export const CYCLE_MONTHS: Record<CycleKey, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  ANNUAL: 12,
};

export const VERSION_LABEL: Record<VersionStatus, string> = {
  PENDING_APPROVAL: 'Waiting for approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
export const VERSION_TONE: Record<VersionStatus, Tone> = {
  PENDING_APPROVAL: 'warn',
  APPROVED: 'ok',
  REJECTED: 'bad',
};
export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  PENDING_APPROVAL: 'Waiting for approval',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
};
export const POLICY_STATUS_TONE: Record<PolicyStatus, Tone> = {
  PENDING_APPROVAL: 'warn',
  ACTIVE: 'ok',
  REJECTED: 'bad',
};

export const BASIS_LABEL: Record<SplitBasis, string> = {
  EQUAL: 'Equal share per flat',
  AREA: 'By flat area',
  UNIT_TYPE_WEIGHT: 'By flat type weight',
  CUSTOM_WEIGHT: 'Custom weight per flat',
};
export const AMOUNT_SOURCE_LABEL = {
  FIXED: 'Fixed amount per month',
  RUN_INPUT: 'Entered on each billing run',
} as const;

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  NONE: 'No late fee',
  SIMPLE_INTEREST: 'Simple interest per year',
  FLAT: 'Flat fee per bill',
};

/** Money in the form: rupees as typed text to integer paise, or null when it is not an amount (max two decimals). */
export function rupeesToPaise(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
/** Integer paise as the text of an amount field: 320 -> "3.2", 350000 -> "3500". */
export function paiseToRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '';
  return String(Number((paise / 100).toFixed(2)));
}

/** A decimal text such as "7.5" is valid when it has at most four decimals and lies in [min, max]. */
export function validPercent(text: string, min: number, max: number): boolean {
  const t = text.trim();
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(t)) return false;
  const n = Number(t);
  return n >= min && n <= max;
}
/** "18.0000" -> "18" and "7.5000" -> "7.5" for reading. */
export const percentText = (p: string | null | undefined) =>
  p === null || p === undefined ? '-' : `${Number(p)}%`;

export const isFirstOfMonth = (iso: string) => /^\d{4}-\d{2}-01$/.test(iso);

/** The amount of a rate for `months` months, stated by the rate per month (BR-11-16). */
export function forMonths(perMonthPaise: number, months: number): number {
  return perMonthPaise * months;
}

export interface DescribeCtx {
  months?: number;
  splitName?: (id: number) => string | undefined;
  headName?: (id: number) => string | undefined;
}

/** One line for a version: "Rs 3.20 per sq ft per month". `months` > 1 adds the amount for the whole period. */
export function describeRate(v: RuleVersion, ctx: DescribeCtx = {}): string {
  const m = ctx.months ?? 1;
  const per = (paise: number, unit: string) =>
    m > 1 ? `${inr(forMonths(paise, m))} per ${unit} for ${m} months` : `${inr(paise)} per ${unit} per month`;
  switch (v.rateType) {
    case 'FLAT_PER_UNIT':
      return per(v.amountPaise ?? 0, 'flat');
    case 'PER_SQFT':
      return per(v.ratePerSqftPaise ?? 0, 'sq ft');
    case 'PER_UNIT_TYPE': {
      const e = Object.entries(v.unitTypeRates ?? {});
      return e.length
        ? e.map(([k, p]) => `${k} ${inr(forMonths(p, m))}`).join(', ') +
            (m > 1 ? ` for ${m} months` : ' per month')
        : 'Per flat type';
    }
    case 'METERED':
      return `Metered ${(v.meterType ?? '').toLowerCase()} by slabs`;
    case 'SPLIT_TOTAL':
      return `Share of a total${v.billSplitRuleId ? ` (${ctx.splitName?.(v.billSplitRuleId) ?? `split rule ${v.billSplitRuleId}`})` : ''}`;
    case 'PERCENT_OF_HEADS': {
      const names = (v.baseChargeHeadIds ?? []).map(id => ctx.headName?.(id) ?? `head ${id}`).join(', ');
      return `${percentText(v.percent)} of ${names || 'other heads'}`;
    }
    default:
      return 'No charge';
  }
}

/** The text a screen reader and the eye get for the status of a version, with the effective date. */
export function versionNote(v: RuleVersion, fmt: (iso: string | null) => string): string {
  return `${VERSION_LABEL[v.status]} · from ${fmt(v.effectiveFrom)}${v.effectiveTo ? ` to ${fmt(v.effectiveTo)}` : ''}`;
}

export const today = () => new Date().toISOString().slice(0, 10);
/** The first day of the next month, as the default "effective from" of a new rate. */
export function nextMonthStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  return d.toISOString().slice(0, 10);
}

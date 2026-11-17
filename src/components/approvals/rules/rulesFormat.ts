import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { approvalError } from '../format';
import type { ApprovalRule, RuleInput, RuleStep } from '@/types/approvalsRules';

const RULE_ERROR: Record<string, string> = {
  STALE_VERSION: 'Someone else changed this. Reload and try again.',
  RULE_NAME_TAKEN: 'Another rule of this type already has this name.',
  RULE_LIMIT_REACHED: 'A type can have at most 20 rules. Delete one first.',
  RULE_AMOUNT_RANGE_INVALID: 'The upper amount cannot be below the lower amount.',
  RULE_STEPS_INVALID: 'The steps are not valid: check the number of approvers and the "at least N" count.',
  STEP_ROLE_UNKNOWN: 'One of the roles is not a role of this society.',
  STEP_ROLE_LACKS_PERMISSION: 'One of the roles cannot approve this kind of item.',
  STEP_USER_NOT_ELIGIBLE: 'One of the named members is not active or cannot approve this kind of item.',
  STEP_CANNOT_BE_SATISFIED: 'Not enough people can fill this step today. Lower the count or add people.',
  APPROVAL_RULE_NOT_FOUND: 'This rule no longer exists.',
  DELEGATION_NOT_FOUND: 'This delegation was not found.',
  DELEGATION_OVERLAP: 'This person already has a delegation in these dates.',
  DELEGATION_NOT_ACTIVE: 'This delegation has already ended.',
  DELEGATION_SELF: 'You cannot delegate to yourself.',
  DELEGATE_NOT_ELIGIBLE: 'This member cannot use the approvals inbox.',
  DELEGATION_CHAIN_NOT_ALLOWED: 'That member is already covered by someone else in these dates.',
  DELEGATION_WINDOW_INVALID: 'Choose dates from now, ending after the start, within 90 days.',
  FEATURE_NOT_IN_PLAN: 'Delegation is not in your plan. Upgrade to Standard or higher.',
};

/** Plain wording for the rule, settings and delegation errors; the field messages of a 400 are kept. */
export const rulesError = (e: unknown): string =>
  e instanceof ApiError && RULE_ERROR[e.code] ? RULE_ERROR[e.code] : approvalError(e);

/** "Up to ₹25,000", "₹25,001 and above", "₹1,000 to ₹5,000" or "Any amount". */
export function amountRange(min: number, max: number | null): string {
  if (!min && max == null) return 'Any amount';
  if (!min) return `Up to ${inr(max)}`;
  if (max == null) return `${inr(min)} and above`;
  return `${inr(min)} to ${inr(max)}`;
}

const MODE_TEXT = { ANY_OF: 'Any one of', ALL_OF: 'All of', N_OF: 'At least' } as const;
export const MODE_LABEL: Record<string, string> = {
  ANY_OF: 'Any one of',
  ALL_OF: 'All of',
  N_OF: 'At least N of',
};

export const roleName = (key: string, names: Record<string, string> = {}) =>
  names[key] ?? key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** "Treasurer → Chairman" or "Auto approved". */
export function stepsSummary(r: Pick<ApprovalRule, 'action' | 'steps'>, names: Record<string, string> = {}) {
  if (r.action === 'AUTO_APPROVE' || r.steps.length === 0) return 'Approved automatically';
  return r.steps
    .map(s => {
      const who = [...s.roleKeys.map(k => roleName(k, names)), ...s.userIds.map(() => 'a named member')];
      const list = who.join(', ');
      if (s.mode === 'N_OF') return `${MODE_TEXT.N_OF} ${s.requiredCount ?? '?'} of ${list}`;
      if (s.mode === 'ALL_OF' && who.length > 1) return `${MODE_TEXT.ALL_OF} ${list}`;
      return who.length > 1 ? `${MODE_TEXT.ANY_OF} ${list}` : list;
    })
    .join(' → ');
}

export const WARNING_TEXT: Record<string, string> = {
  RULE_SHADOWED: 'Never used',
  COVERAGE_GAP: 'Gap in amounts',
  RULE_MAY_BE_UNSATISFIABLE: 'May get stuck',
};

export interface RuleForm {
  name: string;
  description: string;
  priority: string;
  isActive: boolean;
  minRupees: string;
  maxRupees: string;
  categories: string;
  requesterRoles: string[];
  action: 'REQUIRE_APPROVAL' | 'AUTO_APPROVE';
  steps: RuleStep[];
  fallbackRoles: string[];
  slaHours: string;
  reminderEvery: string;
  escalate: boolean;
  escalateAfter: string;
  escalationRoles: string[];
  escalationCanApprove: boolean;
  stepUpRupees: string;
}

export const rupees = (paise: number | null) => (paise == null ? '' : String(paise / 100));
export const toPaise = (v: string) => Math.round(Number(v) * 100);

export const emptyStep = (n: number): RuleStep => ({
  stepNo: n,
  name: '',
  mode: 'ANY_OF',
  roleKeys: [],
  userIds: [],
  requiredCount: null,
});

export function formFrom(r?: ApprovalRule): RuleForm {
  return {
    name: r?.name ?? '',
    description: r?.description ?? '',
    priority: String(r?.priority ?? 100),
    isActive: r?.isActive ?? true,
    minRupees: rupees(r?.minAmountPaise ?? 0) || '0',
    maxRupees: rupees(r?.maxAmountPaise ?? null),
    categories: (r?.categoryKeys ?? []).join(', '),
    requesterRoles: r?.requesterRoleKeys ?? [],
    action: r?.action ?? 'REQUIRE_APPROVAL',
    steps: r?.steps.map(s => ({ ...s })) ?? [{ ...emptyStep(1) }],
    fallbackRoles: r?.fallbackRoleKeys ?? ['chairman'],
    slaHours: String(r?.slaHours ?? 48),
    reminderEvery: String(r?.reminderEveryHours ?? 24),
    escalate: (r ? r.escalateAfterHours : 72) != null,
    escalateAfter: String(r?.escalateAfterHours ?? 72),
    escalationRoles: r?.escalationRoleKeys ?? ['chairman'],
    escalationCanApprove: r?.escalationCanApprove ?? false,
    stepUpRupees: rupees(r?.stepUpAbovePaise ?? null),
  };
}

const int = (v: string) => /^\d+$/.test(v.trim());
const money = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());
const CAT = /^[A-Z0-9_]{2,40}$/;
export const parseCategories = (v: string) =>
  v
    .split(/[,\s]+/)
    .map(x => x.trim().toUpperCase())
    .filter(Boolean);

export type FormErrors = Partial<Record<string, string>>;

/** The BR-14-28 and 8.13 field rules, checked before the call so the messages are immediate. */
export function validateRule(f: RuleForm, isMoney: boolean): FormErrors {
  const e: FormErrors = {};
  const name = f.name.trim();
  if (name.length < 3 || name.length > 80) e.name = 'Enter 3 to 80 characters.';
  if (f.description.length > 300) e.description = 'At most 300 characters.';
  if (!int(f.priority) || +f.priority < 1 || +f.priority > 999) e.priority = 'Enter a number from 1 to 999.';
  if (!money(f.minRupees)) e.min = 'Enter an amount in rupees.';
  if (f.maxRupees.trim() !== '') {
    if (!money(f.maxRupees)) e.max = 'Enter an amount in rupees, or leave empty for no limit.';
    else if (money(f.minRupees) && toPaise(f.maxRupees) < toPaise(f.minRupees))
      e.max = 'The upper amount cannot be below the lower amount.';
  }
  const cats = parseCategories(f.categories);
  if (cats.length > 50 || cats.some(c => !CAT.test(c)) || new Set(cats).size !== cats.length)
    e.categories = 'Use up to 50 different codes of 2 to 40 letters, digits or underscores.';
  if (f.requesterRoles.length > 15) e.requesterRoles = 'Choose at most 15 roles.';
  if (f.action === 'REQUIRE_APPROVAL') {
    if (f.steps.length < 1 || f.steps.length > 5) e.steps = 'Add 1 to 5 steps.';
    f.steps.forEach((s, i) => {
      const slots = s.roleKeys.length + s.userIds.length;
      const n = s.requiredCount ?? 0;
      const sn = i + 1;
      if (s.name.trim().length < 2 || s.name.trim().length > 60)
        e[`step${sn}`] = `Step ${sn}: name 2 to 60 characters.`;
      else if (slots === 0) e[`step${sn}`] = `Step ${sn}: choose at least one role or member.`;
      else if (slots > 10) e[`step${sn}`] = `Step ${sn}: at most 10 roles and members together.`;
      else if (s.mode === 'ALL_OF' && slots > 5) e[`step${sn}`] = `Step ${sn}: "All of" allows at most 5.`;
      else if (s.mode === 'N_OF' && (n < 2 || n > 10 || n > slots))
        e[`step${sn}`] = `Step ${sn}: the count must be 2 or more and not above the ${slots} chosen.`;
    });
  }
  if (f.fallbackRoles.length > 3) e.fallback = 'Choose at most 3 fallback roles.';
  if (!int(f.slaHours) || +f.slaHours < 1 || +f.slaHours > 720) e.sla = 'Enter 1 to 720 hours.';
  if (!int(f.reminderEvery) || +f.reminderEvery < 1 || +f.reminderEvery > 168)
    e.reminder = 'Enter 1 to 168 hours.';
  if (f.escalate) {
    if (!int(f.escalateAfter) || +f.escalateAfter < +f.slaHours || +f.escalateAfter > 1440)
      e.escalate = 'Enter hours from the SLA up to 1440.';
  }
  if (f.escalationRoles.length > 5) e.escalationRoles = 'Choose at most 5 roles.';
  if (isMoney && f.stepUpRupees.trim() !== '' && !money(f.stepUpRupees))
    e.stepUp = 'Enter an amount in rupees.';
  return e;
}

export function inputFrom(f: RuleForm, isMoney: boolean): RuleInput {
  const cats = parseCategories(f.categories);
  const auto = f.action === 'AUTO_APPROVE';
  return {
    name: f.name.trim(),
    ...(f.description.trim() ? { description: f.description.trim() } : {}),
    priority: +f.priority,
    isActive: f.isActive,
    minAmountPaise: toPaise(f.minRupees),
    maxAmountPaise: f.maxRupees.trim() === '' ? null : toPaise(f.maxRupees),
    categoryKeys: cats.length ? cats : null,
    requesterRoleKeys: f.requesterRoles.length ? f.requesterRoles : null,
    action: f.action,
    steps: auto
      ? []
      : f.steps.map((s, i) => ({
          ...s,
          stepNo: i + 1,
          name: s.name.trim(),
          requiredCount: s.mode === 'N_OF' ? s.requiredCount : null,
        })),
    fallbackRoleKeys: f.fallbackRoles,
    slaHours: +f.slaHours,
    reminderEveryHours: +f.reminderEvery,
    escalateAfterHours: f.escalate ? +f.escalateAfter : null,
    escalationRoleKeys: f.escalationRoles,
    escalationCanApprove: f.escalationCanApprove,
    stepUpAbovePaise: isMoney && f.stepUpRupees.trim() !== '' ? toPaise(f.stepUpRupees) : null,
  };
}

/** Dates entered as India time (`datetime-local`) become the instant the API wants. */
export function indiaToIso(local: string): string {
  return new Date(`${local}:00+05:30`).toISOString();
}
/** "2026-11-17T10:30" in India time, for a `datetime-local` default. */
export function indiaNow(offsetMs = 0): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(Date.now() + offsetMs))
    .reduce<Record<string, string>>((a, x) => ({ ...a, [x.type]: x.value }), {});
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

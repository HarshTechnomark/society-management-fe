import { ApiError } from '@/lib/apiClient';
import { limitLabel } from '@/lib/limits';

export const SUBSCRIPTION_PATH = '/admin/settings/subscription';
const PLAN_NAMES: Record<string, string> = {
  STARTER: 'Starter',
  STANDARD: 'Standard',
  PREMIUM: 'Premium',
  ENTERPRISE: 'Enterprise',
};
export const planName = (code: string) => PLAN_NAMES[code] ?? code;

export interface PlanLock {
  kind: 'FEATURE' | 'LIMIT';
  title: string;
  text: string;
  availableIn: string[];
  canUnlock: boolean;
}

/**
 * Reads a 402 (spec 8.1): `FEATURE_NOT_IN_PLAN` carries `errors[0] = { field: 'entitlementKey', message: key,
 * currentPlan, availableIn[], unlockAddon? }`, `USAGE_LIMIT_EXCEEDED` carries `{ field: 'limitKey', message: key,
 * limit, used, requested }`. `upgrade` is false for people who may not open the subscription screen, who then
 * see the plain wording.
 */
export function describePlanLock(e: ApiError, upgrade: boolean): PlanLock | null {
  if (e.status !== 402) return null;
  if (e.code === 'USAGE_LIMIT_EXCEEDED') {
    const d = e.entry('limitKey');
    const label = d ? limitLabel(String(d.message)) : 'This limit';
    const nums = d && typeof d.limit === 'number' ? ` (${d.used ?? '?'} of ${d.limit} used)` : '';
    return {
      kind: 'LIMIT',
      title: 'Limit reached',
      text: upgrade
        ? `${label} has reached the limit of your plan${nums}. Upgrade your plan or buy an add-on to continue.`
        : `${label} has reached the limit of your plan${nums}. Ask your society admin.`,
      availableIn: [],
      canUnlock: false,
    };
  }
  if (e.code !== 'FEATURE_NOT_IN_PLAN') return null;
  const d = e.entry('entitlementKey');
  const availableIn = Array.isArray(d?.availableIn) ? (d.availableIn as string[]) : [];
  const names = availableIn.map(planName);
  return {
    kind: 'FEATURE',
    title: upgrade ? 'Not in your plan' : 'Not available in your plan',
    text: upgrade
      ? `${e.message}${names.length ? ` It comes with ${names.join(', ')}.` : ''}`
      : 'Not available in your plan.',
    availableIn,
    canUnlock: !!d?.unlockAddon,
  };
}

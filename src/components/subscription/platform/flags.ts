import type { Tone } from '@/components/ui/Chip';
import type { FeatureFlag, FlagType } from '@/types/subscriptions';
import { planName } from '../planLock';

export const FLAG_TYPES: FlagType[] = ['GLOBAL', 'PLAN', 'TENANT', 'PERCENTAGE', 'KILL_SWITCH'];
export const FLAG_TYPE_LABEL: Record<FlagType, string> = {
  GLOBAL: 'Global',
  PLAN: 'Plan',
  TENANT: 'Tenant',
  PERCENTAGE: 'Percentage',
  KILL_SWITCH: 'Kill switch',
};
export const FLAG_TYPE_TONE: Record<FlagType, Tone> = {
  GLOBAL: 'info',
  PLAN: 'gold',
  TENANT: 'neutral',
  PERCENTAGE: 'ok',
  KILL_SWITCH: 'bad',
};

/** "Plan · Standard+" for PLAN flags, the type name otherwise. */
export const typeText = (f: Pick<FeatureFlag, 'type' | 'minPlanCode'>) =>
  `${FLAG_TYPE_LABEL[f.type]}${f.type === 'PLAN' && f.minPlanCode ? ` · ${planName(f.minPlanCode)}+` : ''}`;

/** Spec 7.8 flag key format. */
export const FLAG_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

export const EVALUATION_ORDER =
  'Evaluation order: society override, then kill switch, then plan, then percentage, then global default.';
export const ROLLOUT_HINT =
  'Societies are assigned to a stable bucket from 0 to 99. Raising the percentage never removes a society that already has the flag.';

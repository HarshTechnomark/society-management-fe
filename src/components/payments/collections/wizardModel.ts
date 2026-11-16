import { inr } from '@/lib/money';
import type {
  AmountMode,
  AudienceType,
  CollectionDetail,
  CollectionInput,
  CollectionKind,
  Option,
  PayListVisibility,
} from '@/types/collections';
import { addDaysIso, paiseToRupees, rupeesToPaise } from './format';

export interface Draft {
  title: string;
  kind: CollectionKind;
  purpose: string;
  amountMode: AmountMode;
  amount: string;
  minimum: string;
  isMandatory: boolean;
  audienceType: AudienceType;
  buildingIds: number[];
  units: Option[];
  includeVacant: boolean;
  dueDate: string;
  fundId: string;
  target: string;
  payListVisibility: PayListVisibility;
  sendNotice: boolean;
}
export type Errors = Partial<Record<keyof Draft, string>>;

export const emptyDraft = (today: string): Draft => ({
  title: '',
  kind: 'FESTIVAL',
  purpose: '',
  amountMode: 'FIXED_PER_UNIT',
  amount: '',
  minimum: '',
  isMandatory: false,
  audienceType: 'ALL',
  buildingIds: [],
  units: [],
  includeVacant: false,
  dueDate: addDaysIso(today, 15),
  fundId: '',
  target: '',
  payListVisibility: 'COUNT_ONLY',
  sendNotice: true,
});

export const draftOf = (c: CollectionDetail): Draft => ({
  title: c.title,
  kind: c.kind,
  purpose: c.purpose,
  amountMode: c.amountMode,
  amount: c.amountPerUnitPaise ? paiseToRupees(c.amountPerUnitPaise) : '',
  minimum: c.minAmountPaise ? paiseToRupees(c.minAmountPaise) : '',
  isMandatory: c.isMandatory,
  audienceType: c.audienceType,
  buildingIds: c.audienceType === 'BUILDINGS' ? c.audienceIds : [],
  // flat labels are not part of the collection: the ids stand in until the person picks again
  units: c.audienceType === 'UNITS' ? c.audienceIds.map(id => ({ id, label: `Flat ${id}` })) : [],
  includeVacant: c.includeVacant,
  dueDate: c.dueDate.slice(0, 10),
  fundId: c.fundId ? String(c.fundId) : '',
  target: c.targetPaise ? paiseToRupees(c.targetPaise) : '',
  payListVisibility: c.payListVisibility,
  sendNotice: c.sendNotice,
});

export const STEP_FIELDS: (keyof Draft)[][] = [
  ['title', 'kind', 'purpose'],
  ['amountMode', 'amount', 'minimum', 'isMandatory'],
  ['audienceType', 'buildingIds', 'units', 'dueDate'],
  ['fundId', 'target', 'payListVisibility', 'sendNotice'],
];
export const STEP_NAMES = ['What', 'Amount', 'Who pays', 'Fund'];

/** The step a server field belongs to (API field names map to the draft). */
export function stepOfField(field: string): number {
  const key =
    field === 'amountPerUnitPaise'
      ? 'amount'
      : field === 'minAmountPaise'
        ? 'minimum'
        : field === 'targetPaise'
          ? 'target'
          : field === 'audienceIds'
            ? 'units'
            : field;
  const i = STEP_FIELDS.findIndex(f => (f as string[]).includes(key));
  return i < 0 ? 0 : i;
}
export const draftKey = (field: string): keyof Draft =>
  (field === 'amountPerUnitPaise'
    ? 'amount'
    : field === 'minAmountPaise'
      ? 'minimum'
      : field === 'targetPaise'
        ? 'target'
        : field === 'audienceIds'
          ? 'units'
          : field) as keyof Draft;

const MAX_PAISE = 10_000_000;

/** Validation of one step with the messages of spec 8.21. */
export function validateStep(step: number, d: Draft, today: string): Errors {
  const e: Errors = {};
  if (step === 0) {
    const t = d.title.trim();
    if (t.length < 4 || t.length > 80) e.title = 'Enter a title of 4 to 80 characters.';
    const p = d.purpose.trim();
    if (p.length < 10 || p.length > 1000) e.purpose = 'Describe the purpose in 10 to 1000 characters.';
  }
  if (step === 1) {
    if (d.isMandatory && d.amountMode !== 'FIXED_PER_UNIT')
      e.isMandatory = 'A mandatory collection must be a fixed amount per flat.';
    const amount = d.amount.trim() === '' ? null : rupeesToPaise(d.amount);
    if (d.amountMode === 'VOLUNTARY') {
      if (d.amount.trim() !== '' && (amount === null || amount > MAX_PAISE))
        e.amount = 'Enter a suggested amount of ₹0 to ₹1,00,000, or leave it empty.';
    } else if (amount === null || amount < 100 || amount > MAX_PAISE) {
      e.amount = 'Enter an amount of ₹1 to ₹1,00,000 per flat.';
    }
    if (d.amountMode === 'MIN_PER_UNIT') {
      const min = rupeesToPaise(d.minimum);
      if (min === null || min < 100) e.minimum = 'Enter a minimum of at least ₹1.';
      else if (amount !== null && min > amount)
        e.minimum = 'The minimum cannot be more than the suggested amount.';
    }
  }
  if (step === 2) {
    if (d.audienceType === 'BUILDINGS' && d.buildingIds.length === 0)
      e.buildingIds = 'Choose at least one tower.';
    if (d.audienceType === 'UNITS' && d.units.length === 0) e.units = 'Choose at least one flat.';
    if (d.audienceType === 'UNITS' && d.units.length > 2000) e.units = 'Choose at most 2000 flats.';
    if (!d.dueDate || d.dueDate < today || d.dueDate > addDaysIso(today, 365))
      e.dueDate = 'The due date must be from today to one year ahead.';
  }
  if (step === 3) {
    if (!d.fundId) e.fundId = 'Choose the fund this money goes to.';
    const t = d.target.trim() === '' ? null : rupeesToPaise(d.target);
    if (d.amountMode === 'VOLUNTARY' && t === null) e.target = 'Enter the target for a voluntary collection.';
    else if (d.target.trim() !== '' && (t === null || t < 100 || t > 10_000_000_000))
      e.target = 'Enter a target of ₹1 to ₹10,00,00,000.';
  }
  return e;
}

export const flatCount = (d: Draft, buildings: Option[]): number | null =>
  d.audienceType === 'UNITS'
    ? d.units.length
    : d.audienceType === 'ALL'
      ? buildings.reduce((n, b) => n + (b.count ?? 0), 0)
      : buildings.filter(b => d.buildingIds.includes(b.id)).reduce((n, b) => n + (b.count ?? 0), 0);

export function targetHint(d: Draft, flats: number | null): string {
  const amount = rupeesToPaise(d.amount);
  if (d.amountMode === 'VOLUNTARY') return 'Residents give any amount. Enter the amount you hope to raise.';
  if (amount === null || flats === null) return 'Leave it empty to use the number of flats times the amount.';
  return `${flats} flats × ${inr(amount)} = ${inr(flats * amount)}. Leave it empty to use this.`;
}

export function toInput(d: Draft): CollectionInput {
  const amount = rupeesToPaise(d.amount) ?? 0;
  const target = d.target.trim() === '' ? undefined : (rupeesToPaise(d.target) ?? undefined);
  return {
    title: d.title.trim(),
    kind: d.kind,
    purpose: d.purpose.trim(),
    amountMode: d.amountMode,
    amountPerUnitPaise: d.amountMode === 'VOLUNTARY' && d.amount.trim() === '' ? 0 : amount,
    ...(d.amountMode === 'MIN_PER_UNIT' ? { minAmountPaise: rupeesToPaise(d.minimum) ?? 0 } : {}),
    isMandatory: d.isMandatory,
    audienceType: d.audienceType,
    ...(d.audienceType === 'BUILDINGS' ? { audienceIds: d.buildingIds } : {}),
    ...(d.audienceType === 'UNITS' ? { audienceIds: d.units.map(u => u.id) } : {}),
    includeVacant: d.includeVacant,
    dueDate: d.dueDate,
    fundId: Number(d.fundId),
    ...(target !== undefined ? { targetPaise: target } : {}),
    payListVisibility: d.payListVisibility,
    sendNotice: d.sendNotice,
  };
}

'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { LIMIT_LABELS } from '@/lib/limits';
import { inr } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { CatalogueItem, EntitlementRow, PlanSummary, PlanVersionDetail } from '@/types/subscriptions';
import {
  freeMonthsText,
  limitValueText,
  paiseToRupeesText,
  rupeesToPaise,
  subscriptionErrorText,
} from '../format';
import { ReviewDialog, type Diff } from './ReviewDialog';
import { catalogueIndex, groupByModule, moduleLabel, type KeyInfo, type ModuleGroup } from './catalogue';

const LIMIT_KEYS = Object.keys(LIMIT_LABELS);
const MAX_LIMIT = 1_000_000_000_000;

interface Loaded {
  base: PlanVersionDetail;
  catalogue: CatalogueItem[] | null;
}

/**
 * Spec 11.1 **Edit plan** drawer: "Version N. Saving creates version N+1." Opens the plan's draft when one exists.
 * Review and save shows the diff, then a reason; the API sequence is create draft → PATCH → PUT entitlements →
 * publish (step-up is asked by the API client when the server wants it).
 */
export function PlanEditor({
  plan,
  onClose,
  onPublished,
}: {
  plan: PlanSummary;
  onClose: () => void;
  onPublished: () => void;
}) {
  const loaded = useLoad<Loaded>(async () => {
    const [base, catalogue] = await Promise.all([
      subscriptionsService.planVersion(plan.draftVersionId ?? plan.currentVersion.id),
      subscriptionsService.catalogue({ kind: 'FEATURE' }).catch(() => null),
    ]);
    return { base, catalogue };
  });
  const nextNo = plan.currentVersion.versionNo + 1;
  return (
    <Drawer
      open
      size={640}
      onClose={onClose}
      title={`Edit ${plan.name} plan`}
      description={`Version ${plan.currentVersion.versionNo}. Saving creates version ${nextNo}.`}
    >
      {loaded.error ? (
        <ErrorState
          error={loaded.error}
          title="The plan could not be loaded"
          action={
            <Button size="sm" onClick={loaded.reload}>
              Try again
            </Button>
          }
        />
      ) : !loaded.data ? (
        <div className="flex flex-col gap-3" data-testid="editor-loading">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      ) : (
        <EditorForm
          key={`${loaded.data.base.id}-${loaded.data.base.version}`}
          plan={plan}
          base={loaded.data.base}
          catalogue={loaded.data.catalogue}
          nextNo={nextNo}
          onCancel={onClose}
          onPublished={onPublished}
          onDiscarded={onPublished}
        />
      )}
    </Drawer>
  );
}

function EditorForm({
  plan,
  base,
  catalogue,
  nextNo,
  onCancel,
  onPublished,
  onDiscarded,
}: {
  plan: PlanSummary;
  base: PlanVersionDetail;
  catalogue: CatalogueItem[] | null;
  nextNo: number;
  onCancel: () => void;
  onPublished: () => void;
  onDiscarded: () => void;
}) {
  const toast = useToast();
  const index = useMemo(() => catalogueIndex(catalogue), [catalogue]);
  const groups = useMemo(() => groupByModule(base.entitlements, index), [base.entitlements, index]);
  const rowsByKey = useMemo(
    () => new Map(base.entitlements.map(r => [r.entitlementKey, r])),
    [base.entitlements],
  );
  const isEnterprise = plan.code === 'ENTERPRISE';

  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [price, setPrice] = useState(paiseToRupeesText(base.pricePerFlatPaise));
  const [minFlats, setMinFlats] = useState(String(base.minBillableFlats));
  const [freeMonths, setFreeMonths] = useState(String(base.annualFreeMonths));
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      LIMIT_KEYS.map(k => {
        const v = rowsByKey.get(k)?.limitValue;
        return [k, v === null || v === undefined ? '' : String(v)];
      }),
    ),
  );
  const [enabled, setEnabled] = useState<Set<string>>(
    () =>
      new Set(base.entitlements.filter(r => r.kind === 'FEATURE' && r.isEnabled).map(r => r.entitlementKey)),
  );
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Diff[] | null>(null);
  const [discard, setDiscard] = useState(false);

  const toggleKey = (k: KeyInfo, on: boolean) =>
    setEnabled(s => {
      const n = new Set(s);
      if (on) n.add(k.key);
      else n.delete(k.key);
      return n;
    });
  const toggleModule = (g: ModuleGroup, on: boolean) =>
    setEnabled(s => {
      const n = new Set(s);
      for (const k of g.keys) {
        if (k.isAlwaysOn) continue;
        if (on) n.add(k.key);
        else n.delete(k.key);
      }
      return n;
    });

  const validate = () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 60) e.name = 'Enter a plan name of 2 to 60 characters.';
    if (description.trim().length > 300) e.description = 'Keep the description under 300 characters.';
    const p = rupeesToPaise(price);
    if (p === null || p > 50_000 || (p < 100 && !(isEnterprise && p === 0)))
      e.price = isEnterprise ? 'Price must be between ₹0 and ₹500.' : 'Price must be between ₹1 and ₹500.';
    const mf = Number(minFlats);
    if (!/^\d+$/.test(minFlats.trim()) || mf < 1 || mf > 100_000)
      e.minFlats = 'Enter a whole number from 1 to 1,00,000.';
    const fm = Number(freeMonths);
    if (!/^\d+$/.test(freeMonths.trim()) || fm > 6) e.freeMonths = 'Between 0 and 6 months.';
    for (const k of LIMIT_KEYS) {
      const t = (limits[k] ?? '').trim();
      if (t !== '' && (!/^\d+$/.test(t) || Number(t) > MAX_LIMIT))
        e[k] = 'Leave blank for unlimited or enter 0 or more.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const limitValue = (k: string) => {
    const t = (limits[k] ?? '').trim();
    return t === '' ? null : Number(t);
  };
  const changes = () => {
    const planBody: { name?: string; description?: string | null } = {};
    if (name.trim() !== plan.name) planBody.name = name.trim();
    if (description.trim() !== (plan.description ?? '')) planBody.description = description.trim() || null;
    const terms: { pricePerFlatPaise?: number; minBillableFlats?: number; annualFreeMonths?: number } = {};
    const p = rupeesToPaise(price)!;
    if (p !== base.pricePerFlatPaise) terms.pricePerFlatPaise = p;
    if (Number(minFlats) !== base.minBillableFlats) terms.minBillableFlats = Number(minFlats);
    if (Number(freeMonths) !== base.annualFreeMonths) terms.annualFreeMonths = Number(freeMonths);
    const items: Partial<EntitlementRow>[] = [];
    const diffs: Diff[] = [];
    if (planBody.name) diffs.push({ label: 'Name', before: plan.name, after: planBody.name });
    if (planBody.description !== undefined)
      diffs.push({ label: 'Description', before: 'previous text', after: planBody.description ?? '(none)' });
    if (terms.pricePerFlatPaise !== undefined)
      diffs.push({
        label: 'Price per flat per month',
        before: inr(base.pricePerFlatPaise),
        after: inr(terms.pricePerFlatPaise),
      });
    if (terms.minBillableFlats !== undefined)
      diffs.push({
        label: 'Minimum billable flats',
        before: String(base.minBillableFlats),
        after: String(terms.minBillableFlats),
      });
    if (terms.annualFreeMonths !== undefined)
      diffs.push({
        label: 'Annual discount',
        before: freeMonthsText(base.annualFreeMonths),
        after: freeMonthsText(terms.annualFreeMonths),
      });
    for (const k of LIMIT_KEYS) {
      const row = rowsByKey.get(k);
      const before = row?.limitValue ?? null;
      const after = limitValue(k);
      if (row && before !== after) {
        items.push({ entitlementKey: k, limitValue: after });
        diffs.push({
          label: LIMIT_LABELS[k] ?? k,
          before: limitValueText(before, k),
          after: limitValueText(after, k),
        });
      }
    }
    const added: string[] = [];
    const removed: string[] = [];
    for (const g of groups)
      for (const k of g.keys) {
        if (k.isAlwaysOn) continue;
        const was = !!rowsByKey.get(k.key)?.isEnabled;
        const now = enabled.has(k.key);
        if (was !== now) {
          items.push({ entitlementKey: k.key, isEnabled: now });
          (now ? added : removed).push(k.title);
        }
      }
    if (added.length) diffs.push({ label: 'Features added', before: '', after: added.join(', ') });
    if (removed.length) diffs.push({ label: 'Features removed', before: removed.join(', '), after: '' });
    return { planBody, terms, items, diffs };
  };

  const reviewNow = () => {
    if (!validate()) return;
    const { diffs } = changes();
    if (diffs.length === 0) {
      toast.show('No changes to save.', 'warning');
      return;
    }
    setReview(diffs);
  };

  const versionChanges = () => {
    const c = changes();
    return Object.keys(c.terms).length > 0 || c.items.length > 0;
  };

  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input
          label="Plan name"
          value={name}
          onChange={e => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="Price per flat per month (₹)"
          inputMode="decimal"
          value={price}
          onChange={e => setPrice(e.target.value)}
          error={errors.price}
          hint={isEnterprise ? '₹0 is allowed; each society gets a custom price.' : '₹1 to ₹500'}
          required
        />
        <div className="sm:col-span-2">
          <Input
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            error={errors.description}
          />
        </div>
        <Input
          label="Minimum billable flats"
          inputMode="numeric"
          value={minFlats}
          onChange={e => setMinFlats(e.target.value)}
          error={errors.minFlats}
          required
        />
        <Input
          label="Months free when paid yearly"
          inputMode="numeric"
          value={freeMonths}
          onChange={e => setFreeMonths(e.target.value)}
          error={errors.freeMonths}
          hint="With 2, a year costs 10 months."
          required
        />
      </div>

      <h3 className="mb-2 mt-2 text-[15px] font-bold">
        Usage limits <span className="text-[13px] font-medium text-muted">(blank = unlimited)</span>
      </h3>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {LIMIT_KEYS.filter(k => rowsByKey.has(k)).map(k => (
          <Input
            key={k}
            label={`${LIMIT_LABELS[k]}${k === 'limit.storage_gb' ? ' (GB)' : ''}`}
            inputMode="numeric"
            value={limits[k] ?? ''}
            placeholder="Unlimited"
            onChange={e => setLimits(l => ({ ...l, [k]: e.target.value }))}
            error={errors[k]}
          />
        ))}
      </div>

      <h3 className="mb-2 mt-2 text-[15px] font-bold">Included modules</h3>
      <ul className="mb-4 flex flex-col divide-y divide-[var(--line)] rounded-[16px] border border-[var(--line)] bg-white/50">
        {groups.map(g => {
          const optional = g.keys.filter(k => !k.isAlwaysOn);
          const on = optional.filter(k => enabled.has(k.key)).length;
          const all = optional.length === 0 || on === optional.length;
          const some = on > 0 && !all;
          const isOpen = open.has(g.moduleNo);
          const listId = `mod-${g.moduleNo}-keys`;
          return (
            <li key={g.moduleNo} className="px-3 py-2">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`${moduleLabel(g.moduleNo)}: all features`}
                  className="h-[18px] w-[18px] shrink-0 accent-[#143041]"
                  checked={all}
                  disabled={optional.length === 0}
                  ref={el => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={e => toggleModule(g, e.target.checked)}
                />
                <span className="min-w-0 flex-1 text-[14px]">
                  <span className="font-mono text-[12px] text-faint">
                    {String(g.moduleNo).padStart(2, '0')}
                  </span>{' '}
                  {moduleLabel(g.moduleNo).slice(5)}
                  <span className="ml-2 text-[12.5px] text-muted">
                    {optional.length === 0 ? 'Always on' : `${on} of ${optional.length}`}
                  </span>
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  onClick={() =>
                    setOpen(s => {
                      const n = new Set(s);
                      if (n.has(g.moduleNo)) n.delete(g.moduleNo);
                      else n.add(g.moduleNo);
                      return n;
                    })
                  }
                >
                  {isOpen ? 'Hide keys' : 'Show keys'}
                </Button>
              </div>
              {isOpen && (
                <ul id={listId} className="mt-2 flex flex-col gap-1 pl-7">
                  {g.keys.map(k => (
                    <li key={k.key}>
                      <label className="flex items-start gap-2 text-[13.5px]">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#143041]"
                          checked={k.isAlwaysOn || enabled.has(k.key)}
                          disabled={k.isAlwaysOn}
                          onChange={e => toggleKey(k, e.target.checked)}
                        />
                        <span>
                          {k.title}
                          {k.isAlwaysOn && <span className="text-muted"> (always on)</span>}
                          <span className="block font-mono text-[11.5px] text-faint">{k.key}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-[var(--line)] bg-[rgba(251,247,240,0.98)] p-4">
        {base.status === 'DRAFT' && (
          <Button variant="danger-soft" onClick={() => setDiscard(true)} className="mr-auto">
            Discard draft
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={reviewNow}>Review and save</Button>
      </div>

      {review && (
        <ReviewDialog
          title={versionChanges() ? `Publish ${name.trim()} v${nextNo}` : `Save ${name.trim()}`}
          text={
            versionChanges()
              ? `Applies to new subscriptions. ${plan.activeSubscriptions} existing societies keep their current price until you migrate them.`
              : 'Name and description apply at once.'
          }
          confirmLabel={versionChanges() ? `Publish v${nextNo}` : 'Save'}
          diffs={review}
          onCancel={() => setReview(null)}
          onConfirm={reason => save(plan, base, changes(), reason)}
          onDone={published => {
            setReview(null);
            toast.show(published ? `${name.trim()} v${nextNo} published.` : 'Plan saved.');
            onPublished();
          }}
        />
      )}
      {discard && (
        <Modal
          open
          onClose={() => setDiscard(false)}
          title={`Discard the draft v${base.versionNo}?`}
          description="The draft and its changes are deleted. The published version stays as it is."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDiscard(false)}>
                Keep draft
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await subscriptionsService.deleteDraft(base.id, base.version);
                    toast.show('Draft discarded.');
                    onDiscarded();
                  } catch (e) {
                    toast.show(subscriptionErrorText(e), 'error');
                  }
                }}
              >
                Discard draft
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </>
  );
}

type Changes = {
  planBody: { name?: string; description?: string | null };
  terms: { pricePerFlatPaise?: number; minBillableFlats?: number; annualFreeMonths?: number };
  items: Partial<EntitlementRow>[];
};

/** The publish sequence; returns true when a version was published. Re-runs pick up a draft made by a failed run. */
async function save(
  plan: PlanSummary,
  base: PlanVersionDetail,
  c: Changes,
  reason: string,
): Promise<boolean> {
  if (c.planBody.name !== undefined || c.planBody.description !== undefined)
    await subscriptionsService.updatePlan(plan.id, { ...c.planBody, reason, version: plan.version });
  const versionChanged = Object.keys(c.terms).length > 0 || c.items.length > 0;
  if (!versionChanged) return false;
  let draft: PlanVersionDetail;
  if (base.status === 'DRAFT') draft = await subscriptionsService.planVersion(base.id);
  else {
    try {
      draft = await subscriptionsService.createDraft(plan.id, reason);
    } catch (e) {
      const id = e instanceof ApiError && e.code === 'DRAFT_ALREADY_EXISTS' ? draftIdOf(e) : null;
      if (!id) throw e;
      draft = await subscriptionsService.planVersion(id);
    }
  }
  let version = draft.version;
  if (Object.keys(c.terms).length > 0)
    version = (await subscriptionsService.updateDraft(draft.id, { ...c.terms, version })).version;
  if (c.items.length > 0)
    version = (await subscriptionsService.setEntitlements(draft.id, { items: c.items, version })).version;
  await subscriptionsService.publish(draft.id, { reason, version });
  return true;
}

function draftIdOf(e: ApiError): number | null {
  const entry = e.entry('draftVersionId');
  const raw = entry?.draftVersionId ?? entry?.message;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

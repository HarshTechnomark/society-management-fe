'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { inr } from '@/lib/money';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { PlanSummary, PlanVersionDetail } from '@/types/subscriptions';
import { PLAN_TONE, freeMonthsText, limitValueText } from '../format';
import { AddonPricesDrawer } from './AddonPricesDrawer';
import { MigrateDialog } from './MigrateDialog';
import { PlanEditor } from './PlanEditor';
import {
  MODULE_COUNT,
  catalogueIndex,
  coverage,
  enabledKeys,
  groupByModule,
  limitOf,
  moduleName,
  type KeyInfo,
} from './catalogue';

export interface PlanWithVersion {
  plan: PlanSummary;
  version: PlanVersionDetail | null;
}

async function loadPlans(): Promise<PlanWithVersion[]> {
  const plans = await subscriptionsService.plans();
  const versions = await Promise.all(
    plans.map(p => subscriptionsService.planVersion(p.currentVersion.id).catch(() => null)),
  );
  return plans
    .map((plan, i) => ({ plan, version: versions[i] ?? null }))
    .sort((a, b) => a.plan.tierRank - b.plan.tierRank);
}

const CARD_LIMITS: [string, string][] = [
  ['limit.flats', 'Flats'],
  ['limit.sms_per_month', 'SMS / month'],
  ['limit.whatsapp_per_month', 'WhatsApp / month'],
  ['limit.storage_gb', 'Storage'],
  ['limit.guard_devices', 'Guard consoles'],
  ['limit.ai_messages_per_month', 'AI messages'],
];

/** Spec 11.1: Super Admin › Plans and pricing. */
export function PlansScreen() {
  const { ready } = useMe();
  const canView = usePermission(PERMISSIONS.platform.plans.view);
  const canEdit = usePermission(PERMISSIONS.platform.plans.edit);
  const canApprove = usePermission(PERMISSIONS.platform.plans.approve);
  const data = useLoad(loadPlans);
  const [editing, setEditing] = useState<PlanSummary | null>(null);
  const [migrating, setMigrating] = useState<PlanSummary | null>(null);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const index = useMemo(() => catalogueIndex(null), []);

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Plans and pricing" />
        <Card>
          <EmptyState title="You do not have access to this page" />
        </Card>
      </Page>
    );

  const list = data.data ?? [];
  return (
    <Page>
      <PageHead
        title="Plans and pricing"
        sub="Changes apply to new subscriptions. Moving existing subscriptions to the new price is a separate, explicit action."
        actions={
          <Button size="sm" variant="glass" onClick={() => setAddonsOpen(true)}>
            Add-on prices
          </Button>
        }
      />
      {data.error ? (
        <Card>
          <ErrorState
            error={data.error}
            title="Plans could not be loaded"
            action={
              <Button size="sm" onClick={data.reload}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : data.loading && !data.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="plans-loading">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton h-[420px] rounded-[24px]" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {list.map(item => (
              <PlanCard
                key={item.plan.id}
                item={item}
                index={index}
                canEdit={canEdit}
                canApprove={canApprove}
                onEdit={() => setEditing(item.plan)}
                onMigrate={() => setMigrating(item.plan)}
              />
            ))}
          </div>
          <PlanMatrix list={list} index={index} />
        </>
      )}

      {editing && (
        <PlanEditor
          plan={editing}
          onClose={() => setEditing(null)}
          onPublished={() => {
            setEditing(null);
            data.reload();
          }}
        />
      )}
      {migrating && (
        <MigrateDialog
          plan={migrating}
          onClose={() => setMigrating(null)}
          onDone={() => {
            setMigrating(null);
            data.reload();
          }}
        />
      )}
      <AddonPricesDrawer open={addonsOpen} onClose={() => setAddonsOpen(false)} canEdit={canEdit} />
    </Page>
  );
}

function PlanCard({
  item,
  index,
  canEdit,
  canApprove,
  onEdit,
  onMigrate,
}: {
  item: PlanWithVersion;
  index: Map<string, KeyInfo>;
  canEdit: boolean;
  canApprove: boolean;
  onEdit: () => void;
  onMigrate: () => void;
}) {
  const { plan, version } = item;
  const v = plan.currentVersion;
  const rows = version?.entitlements ?? [];
  const on = enabledKeys(rows);
  const modules = groupByModule(rows, index).filter(g => coverage(g, on) !== 'NONE').length;
  return (
    <article className="glass flex flex-col gap-3 p-5" aria-label={`${plan.name} plan`}>
      <div className="flex items-center justify-between gap-2">
        <Chip tone={PLAN_TONE[plan.code]}>{plan.name}</Chip>
        <span className="text-[12.5px] text-muted">
          v{v.versionNo}
          {plan.draftVersionId ? ' · draft open' : ''}
          {!plan.isActive ? ' · inactive' : ''}
        </span>
      </div>
      <div>
        <span className="text-[32px] font-bold tracking-tight">{inr(v.pricePerFlatPaise)}</span>
        <span className="text-muted"> / flat / month</span>
      </div>
      <p className="min-h-[40px] text-[14px] text-muted">{plan.description ?? ''}</p>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[13.5px]">
        <dt className="text-muted">Minimum flats</dt>
        <dd className="text-right font-semibold">{v.minBillableFlats.toLocaleString('en-IN')}</dd>
        <dt className="text-muted">Annual discount</dt>
        <dd className="text-right font-semibold">{freeMonthsText(v.annualFreeMonths)}</dd>
        {CARD_LIMITS.map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-semibold">
              {version ? limitValueText(limitOf(rows, key), key) : '-'}
            </dd>
          </div>
        ))}
        <dt className="text-muted">Modules</dt>
        <dd className="text-right font-semibold">{version ? `${modules} of ${MODULE_COUNT}` : '-'}</dd>
      </dl>
      <p className="border-t border-[var(--line)] pt-2.5 text-[13px] text-muted">
        <b className="text-ink">{plan.activeSubscriptions}</b> societies ·{' '}
        <b className="text-ink">{inr(plan.mrrPaise)}</b> MRR
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        {canEdit && (
          <Button size="sm" onClick={onEdit}>
            Edit plan
          </Button>
        )}
        {canApprove && plan.onOlderVersions > 0 && (
          <Button size="sm" variant="gold" onClick={onMigrate}>
            Migrate {plan.onOlderVersions}
          </Button>
        )}
      </div>
    </article>
  );
}

/** "What each plan includes": module rows × plan columns with tick, "Some" or "-". */
function PlanMatrix({ list, index }: { list: PlanWithVersion[]; index: Map<string, KeyInfo> }) {
  const columns = list.map(({ plan, version }) => {
    const rows = version?.entitlements ?? [];
    const on = enabledKeys(rows);
    return {
      plan,
      loaded: !!version,
      byModule: new Map(groupByModule(rows, index).map(g => [g.moduleNo, coverage(g, on)])),
    };
  });
  const modules = [...new Set(columns.flatMap(c => [...c.byModule.keys()]))].sort((a, b) => a - b);
  if (modules.length === 0) return null;
  return (
    <Card
      className="mt-4"
      title="What each plan includes"
      sub="Module entitlements by plan. Overrides per society are managed on the society page."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[14px]">
          <caption className="sr-only">What each plan includes</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[12px] uppercase text-muted">
              <th scope="col" className="px-3 py-2">
                Module
              </th>
              {columns.map(c => (
                <th key={c.plan.id} scope="col" className="px-3 py-2 text-center">
                  {c.plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map(m => (
              <tr key={m} className="border-b border-[var(--line)] last:border-0">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="font-mono text-[12px] text-faint">{String(m).padStart(2, '0')}</span>{' '}
                  <b>{moduleName(m)}</b>
                </th>
                {columns.map(c => {
                  const cov = c.byModule.get(m) ?? 'NONE';
                  return (
                    <td key={c.plan.id} className="px-3 py-2 text-center">
                      {!c.loaded ? (
                        <span className="text-faint">?</span>
                      ) : cov === 'ALL' ? (
                        <span className="font-bold text-ok" aria-label="Included">
                          ✓
                        </span>
                      ) : cov === 'SOME' ? (
                        <span className="text-[12.5px] font-semibold text-warn">Some</span>
                      ) : (
                        <span className="text-faint" aria-label="Not included">
                          -
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

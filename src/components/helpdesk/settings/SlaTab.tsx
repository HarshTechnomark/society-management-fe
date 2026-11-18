'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { SUBSCRIPTION_PATH } from '@/components/subscription/planLock';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { useFeatureState } from '@/lib/entitlements';
import { helpdeskSettingsService as svc } from '@/services/helpdeskSettings.service';
import type { SlaPolicy } from '@/types/helpdesk';
import { helpdeskError, isStale, plainError } from '../admin/format';
import { ConfirmDialog } from './ConfirmDialog';
import { PolicyDrawer, policyField } from './PolicyDrawer';
import { PRIORITIES, PRIORITY_NAME, minutesLabel } from './settingsFormat';

/** SLA policies: a table of the four priorities per policy (spec 8.4). */
export function SlaTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const businessOk = useFeatureState('helpdesk.sla_business_calendar');
  const load = useLoad(() => svc.policies('ACTIVE'), 'policies');
  const [editing, setEditing] = useState<SlaPolicy | 'new' | null>(null);
  const [archiving, setArchiving] = useState<SlaPolicy | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.show(ok);
      load.reload();
    } catch (e) {
      toast.show(helpdeskError(e));
      if (isStale(e)) load.reload();
    }
  };
  if (load.error != null)
    return (
      <ErrorState
        error={plainError(load.error)}
        action={
          <Button size="sm" onClick={load.reload}>
            Try again
          </Button>
        }
      />
    );
  if (load.loading || !load.data)
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="skeleton h-40 w-full"
        data-testid="skeleton-row"
      />
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-muted">How fast each priority must be answered and fixed.</p>
        {canEdit && <Button onClick={() => setEditing('new')}>Add policy</Button>}
      </div>
      {load.data.length === 0 ? (
        <EmptyState title="No SLA policies" text="Add a policy and make it the default." />
      ) : (
        load.data.map(p => (
          <section key={p.id} aria-label={p.name} className="rounded-2xl bg-white/50 p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold">{p.name}</h3>
              {p.isDefault && <Chip tone="ok">Default</Chip>}
              {canEdit && (
                <span className="ml-auto flex gap-1.5">
                  <Button size="xs" variant="glass" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  {!p.isDefault && (
                    <Button size="xs" variant="danger-soft" onClick={() => setArchiving(p)}>
                      Archive
                    </Button>
                  )}
                </span>
              )}
            </div>
            {p.description && <p className="mb-2 text-[13px] text-muted">{p.description}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1 pr-3 font-semibold">Priority</th>
                    <th className="py-1 pr-3 font-semibold">Reply within</th>
                    <th className="py-1 pr-3 font-semibold">Fix within</th>
                    <th className="py-1 font-semibold">Clock</th>
                  </tr>
                </thead>
                <tbody>
                  {PRIORITIES.map((pr, i) => (
                    <tr key={pr} className="border-t border-[var(--line)]">
                      <td className="py-1.5 pr-3 font-semibold">{PRIORITY_NAME[pr]}</td>
                      <td className="py-1.5 pr-3">{minutesLabel(policyField(p, pr, 'Response'))}</td>
                      <td className="py-1.5 pr-3">{minutesLabel(policyField(p, pr, 'Resolution'))}</td>
                      <td className="py-1.5">
                        {i === 0
                          ? '24 x 7'
                          : p[`p${i + 1}Calendar` as 'p2Calendar'] === 'BUSINESS_HOURS'
                            ? 'Office hours'
                            : '24 x 7'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
      {!businessOk && (
        <p className="text-[12.5px] text-muted">
          Office hours clocks come with the Standard plan.{' '}
          <Link href={SUBSCRIPTION_PATH} className="underline">
            See plans
          </Link>
        </p>
      )}
      {editing && (
        <PolicyDrawer
          policy={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load.reload();
          }}
        />
      )}
      {archiving && (
        <ConfirmDialog
          title={`Archive ${archiving.name}`}
          confirmLabel="Archive"
          onCancel={() => setArchiving(null)}
          onConfirm={async () => {
            const p = archiving;
            setArchiving(null);
            await run(() => svc.archivePolicy(p.id, p.version), 'Archived');
          }}
        >
          Tickets already using it keep their due times. A policy that an active category uses cannot be
          archived.
        </ConfirmDialog>
      )}
    </div>
  );
}

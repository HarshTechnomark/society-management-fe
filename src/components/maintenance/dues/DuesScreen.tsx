'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Tabs } from '@/components/residents/common';
import { ConfirmDialog } from '@/components/setup/ConfirmDialog';
import { Gate } from '@/components/setup/Gate';
import { FeatureGate, PlanLocked } from '@/components/subscription/FeatureGate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { billingDuesService } from '@/services/billingDues.service';
import type { BulkReminderResult, DuesSummary } from '@/types/billingDues';
import { DefaultersTab } from './DefaultersTab';
import { AGEING_LABEL, billingDuesError, currentMonth, plainError } from './format';

const B = PERMISSIONS.finance.billing;
type TabKey = 'dashboard' | 'defaulters';

/** Money > Dues (spec 11.1 and 11.8): the dues dashboard and the defaulter list. Invoices have their own page. */
export function DuesScreen() {
  return (
    <Gate view={B.view} title="Dues">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canRemind = usePermission(B.edit);
  const canRun = usePermission(B.create);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [month, setMonth] = useState(currentMonth());
  const [confirm, setConfirm] = useState(false);
  const [bulk, setBulk] = useState<BulkReminderResult | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const summary = useLoad(() => billingDuesService.summary(month), month);

  const flats = summary.data?.overdueFlats;
  const remindAll = async () => {
    setBulk(null);
    setBulkError(null);
    try {
      setBulk(await billingDuesService.remindAllOverdue());
    } catch (e) {
      setBulkError(billingDuesError(e));
    }
    setConfirm(false);
  };

  return (
    <Page>
      <PageHead
        title="Dues"
        sub="What was billed, what came in and who is behind. Names are visible to the committee only."
        actions={
          <>
            <Link href="/admin/billing/invoices" className={buttonClasses('glass', 'md')}>
              All invoices
            </Link>
            {canRemind && (
              <Button variant="glass" onClick={() => setConfirm(true)}>
                Remind all overdue
              </Button>
            )}
            {canRun && (
              <Link href="/admin/billing/runs/new" className={buttonClasses('primary', 'md')}>
                Run billing
              </Link>
            )}
          </>
        }
      />
      {bulk && (
        <Alert tone="ok">
          {bulk.flats === 0
            ? 'No flat has an overdue bill to remind.'
            : `Reminders are on their way to ${bulk.flats} ${bulk.flats === 1 ? 'flat' : 'flats'} for ${bulk.invoices} ${bulk.invoices === 1 ? 'bill' : 'bills'}. Bills reminded in the last 24 hours are skipped.`}
        </Alert>
      )}
      {bulkError && <Alert tone="bad">{bulkError}</Alert>}
      <Tabs
        label="Dues sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'defaulters', label: 'Defaulters' },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'dashboard' ? (
          <Dashboard
            month={month}
            onMonth={setMonth}
            summary={summary.data}
            loading={summary.loading}
            error={summary.error}
            onRetry={summary.reload}
            onDefaulters={() => setTab('defaulters')}
          />
        ) : (
          <FeatureGate
            feature="billing.defaulter_list"
            title="Defaulters"
            fallback={<PlanLocked title="Defaulters" />}
          >
            <DefaultersTab />
          </FeatureGate>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={
          flats === undefined
            ? 'Remind all overdue flats?'
            : `Remind ${flats} ${flats === 1 ? 'flat' : 'flats'}?`
        }
        description="Every flat with an overdue bill gets a reminder. A bill reminded in the last 24 hours is skipped."
        confirmLabel="Send reminders"
        variant="primary"
        onCancel={() => setConfirm(false)}
        onConfirm={remindAll}
      />
    </Page>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="glass p-4" data-testid="kpi">
      <div className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[24px] font-bold tabular-nums">{value}</div>
      {note && <div className="text-[13px] text-muted">{note}</div>}
    </div>
  );
}

function Dashboard({
  month,
  onMonth,
  summary,
  loading,
  error,
  onRetry,
  onDefaulters,
}: {
  month: string;
  onMonth: (m: string) => void;
  summary: DuesSummary | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onDefaulters: () => void;
}) {
  const max = Math.max(1, ...(summary?.ageing ?? []).map(a => a.amountPaise));
  return (
    <>
      <div className="mb-3 max-w-[14rem]">
        <Input
          label="Month"
          type="month"
          value={month}
          max={currentMonth()}
          onChange={e => e.target.value && onMonth(e.target.value)}
        />
      </div>
      {error != null ? (
        <Card>
          <ErrorState
            error={plainError(error)}
            action={
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : loading || !summary ? (
        <div aria-busy="true" aria-label="Loading" className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton h-24 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <Tile label="Billed this month" value={inr(summary.billedPaise)} />
            <Tile
              label="Collected"
              value={inr(summary.collectedPaise)}
              note={
                summary.efficiencyPct === null
                  ? 'No bills this month'
                  : `${summary.efficiencyPct.toFixed(1)}% efficiency`
              }
            />
            <Tile label="Outstanding" value={inr(summary.outstandingPaise)} note="All open bills" />
            <Tile
              label="Overdue flats"
              value={String(summary.overdueFlats)}
              note={
                summary.overdueFlats === 1 ? '1 flat is behind' : `${summary.overdueFlats} flats are behind`
              }
            />
          </div>
          <Card title="Ageing of overdue" sub="Open bills by days past the due date" className="mt-4">
            <ul className="grid gap-3">
              {summary.ageing.map(a => (
                <li key={a.bucket} data-testid="ageing-row">
                  <div className="flex justify-between text-[14px]">
                    <span>{AGEING_LABEL[a.bucket]}</span>
                    <strong className="tabular-nums">{inr(a.amountPaise)}</strong>
                  </div>
                  <div
                    className="mt-1 h-2 overflow-hidden rounded-full bg-black/10"
                    role="meter"
                    aria-label={AGEING_LABEL[a.bucket]}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={a.amountPaise}
                    aria-valuetext={inr(a.amountPaise)}
                  >
                    <div
                      className="h-full rounded-full bg-[#b9770e]"
                      style={{ width: `${a.amountPaise ? Math.max(3, (a.amountPaise / max) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {summary.overdueFlats > 0 && (
              <p className="mt-4 text-[13.5px]">
                <button type="button" className="font-semibold underline" onClick={onDefaulters}>
                  See the defaulter list
                </button>{' '}
                or{' '}
                <Link className="font-semibold underline" href="/admin/billing/invoices">
                  open the invoices
                </Link>
                .
              </p>
            )}
          </Card>
        </>
      )}
      <p className="sr-only">Month shown: {month}</p>
    </>
  );
}

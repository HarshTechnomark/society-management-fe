'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { ListBody, NoRows, StatusChip } from '@/components/payments/ops/Bits';
import { PlanLocked } from '@/components/subscription/FeatureGate';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/apiClient';
import { getMe } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsSettlementsService } from '@/services/accountsSettlements.service';
import type { SettlementStatus } from '@/types/accountsSettlements';
import { SETTLEMENT_STATUS_LABEL, SETTLEMENT_STATUS_TONE, plainError } from '../statements/format';
import { ImportSettlementDialog } from './ImportSettlementDialog';
import { SettlementDrawer } from './SettlementDrawer';

const P = PERMISSIONS.finance.bank;

/** Gateway settlements (spec 8.15, 11.5): table with status chips, import a report, open one to reconcile. */
export function SettlementsScreen() {
  return (
    <Gate view={P.view} feature="payments.settlement_reconciliation" title="Settlements">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const toast = useToast();
  const canImport = usePermission(P.import);
  const canApprove = usePermission(P.approve);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const load = useLoad(
    () =>
      accountsSettlementsService.list({
        status: status as SettlementStatus | '',
        q: q.trim() || undefined,
        page,
        limit: 20,
      }),
    `${status}|${q}|${page}`,
  );
  const filtered = !!(status || q);
  const [generating, setGenerating] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  /** Development only: the practice gateway has no payout report, so this builds one from the captured online payments. */
  const generate = async () => {
    const societyId = getMe()?.activeSocietyId;
    if (!societyId) return;
    setGenerating(true);
    setDevError(null);
    try {
      const r = await accountsSettlementsService.devGenerate(societyId, false);
      toast.show(`Settlement ${r.gatewaySettlementId} generated from ${r.payments} payments.`);
      load.reload();
    } catch (e) {
      setDevError(
        e instanceof ApiError && e.code === 'NOTHING_TO_SETTLE'
          ? 'No captured online payment is waiting for a settlement. Pay an invoice online first.'
          : plainError(e) instanceof Error
            ? (plainError(e) as Error).message
            : 'The test settlement could not be generated.',
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Settlements"
        sub="Payouts from your payment gateway, matched with the payments you recorded."
        actions={
          canImport && (
            <>
              {process.env.NODE_ENV !== 'production' && (
                <Button variant="glass" loading={generating} onClick={() => void generate()}>
                  Generate a test settlement
                </Button>
              )}
              <Button onClick={() => setImporting(true)}>Import a settlement report</Button>
            </>
          )
        }
      />
      {devError && (
        <Alert tone="bad" className="mb-3">
          {devError}
        </Alert>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Status"
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              ...Object.entries(SETTLEMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Input
            label="Settlement id or UTR"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <ListBody
          load={{ ...load, error: load.error ? plainError(load.error) : load.error }}
          label="Settlements"
          page={page}
          onPage={setPage}
          locked={<PlanLocked title="Settlements" />}
          empty={
            <NoRows
              title={filtered ? 'No settlements match' : 'No settlements yet'}
              text={
                filtered
                  ? 'Change the filters.'
                  : 'Import the settlement report of your gateway to see payouts here.'
              }
            />
          }
        >
          {items =>
            items.map(s => (
              <li
                key={s.id}
                data-testid="settlement-row"
                className="grid gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[7rem_1fr_6rem_5rem_7rem_8rem_7rem_6.5rem] min-[900px]:items-center"
              >
                <span className="text-[13.5px]">{shortDate(s.settlementDate)}</span>
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-[14.5px] font-bold underline-offset-2 hover:underline"
                  onClick={() => setOpen(s.id)}
                  aria-label={`Details of ${s.gatewaySettlementId}`}
                >
                  {s.gatewaySettlementId}
                </button>
                <span className="text-[13px] text-muted">{s.utr ?? '-'}</span>
                <span className="text-[13.5px]">{s.paymentCount} payments</span>
                <span className="text-[13.5px] tabular-nums">Gross {inr(s.grossPaise)}</span>
                <span className="text-[13.5px] tabular-nums">
                  Fees + GST {inr(s.feePaise + s.feeGstPaise)}
                </span>
                <span className="text-[14px] font-semibold tabular-nums">Net {inr(s.netPaise)}</span>
                <span>
                  <StatusChip tone={SETTLEMENT_STATUS_TONE[s.status] ?? 'neutral'}>
                    {SETTLEMENT_STATUS_LABEL[s.status] ?? s.status}
                  </StatusChip>
                </span>
              </li>
            ))
          }
        </ListBody>
      </Card>
      {importing && <ImportSettlementDialog onClose={() => setImporting(false)} onDone={load.reload} />}
      {open !== null && (
        <SettlementDrawer
          id={open}
          canImport={canImport}
          canApprove={canApprove}
          onClose={() => setOpen(null)}
          onChanged={load.reload}
        />
      )}
    </Page>
  );
}

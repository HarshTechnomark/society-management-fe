'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { DataTable, type Column } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Tabs } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useFlag } from '@/lib/entitlements';
import { redirectTo } from '@/lib/gatewayCheckout';
import { inr, shortDate } from '@/lib/money';
import { platformBillingService as svc } from '@/services/platform-billing.service';
import type { BillingSummary, CreditItem, InvoiceListItem, PaymentItem } from '@/types/platformBilling';
import { FormModal } from '../FormModal';
import {
  InvoiceStatusChip,
  KIND_LABEL,
  PaymentStatusChip,
  billingError,
  isOpen,
  methodText,
  periodText,
  rupeesToPaise,
} from '../format';
import { Pager, useServerList } from '../useServerList';
import { CertificateModal } from './CertificateModal';
import { InvoiceSheet } from './InvoiceSheet';
import { PayDialog } from './PayDialog';

type Tab = 'invoices' | 'payments' | 'credits';

const AUTOPAY_TEXT: Record<string, string> = {
  NONE: 'Not set up',
  PENDING: 'Waiting for your bank',
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

/**
 * Spec 11.3: billing summary, autopay, invoices, payments and credits for the society admin. It sits on the
 * Settings > Subscription page below the plan, and the module 05 "Pay now" button lands there.
 */
export function BillingSection({ nextInvoiceDate }: { nextInvoiceDate?: string | null }) {
  const canEdit = usePermission(PERMISSIONS.settings.subscription.edit);
  const autopayOn = useFlag('platform.autopay');
  const toast = useToast();
  const summary = useLoad(() => svc.summary());
  const [tab, setTab] = useState<Tab>('invoices');
  const [epoch, setEpoch] = useState(0);
  const [paying, setPaying] = useState<{
    id: number;
    invoiceNo: string | null;
    amountDuePaise: number;
  } | null>(null);
  const [finding, setFinding] = useState(false);

  const changed = () => {
    summary.reload();
    setEpoch(e => e + 1);
  };

  const payOldest = async () => {
    setFinding(true);
    try {
      const r = await svc.invoices({
        status: 'ISSUED,PARTIALLY_PAID,OVERDUE',
        documentType: 'INVOICE',
        sortBy: 'dueDate',
        sortOrder: 'asc',
        limit: 1,
      });
      if (r.items[0]) setPaying(r.items[0]);
      else toast.show('There is nothing to pay.', 'warning');
    } catch (e) {
      toast.show(billingError(e), 'error');
    } finally {
      setFinding(false);
    }
  };

  const s = summary.data;
  return (
    <div className="flex flex-col gap-4" aria-label="Billing">
      <h2 className="mt-2 text-[20px] font-bold">Billing</h2>
      <Card>
        {summary.error ? (
          <ErrorState
            error={summary.error}
            title="Billing could not be loaded"
            action={
              <Button size="sm" onClick={summary.reload}>
                Try again
              </Button>
            }
          />
        ) : !s ? (
          <div className="skeleton h-28" data-testid="billing-loading" />
        ) : (
          <SummaryCard
            s={s}
            nextInvoiceDate={nextInvoiceDate}
            canPay={canEdit && s.openInvoiceCount > 0}
            busy={finding}
            onPay={payOldest}
          />
        )}
      </Card>
      {autopayOn && s && (
        <AutopayCard
          status={s.autopayStatus}
          canEdit={canEdit}
          suspended={s.societyStatus === 'SUSPENDED'}
          onChanged={changed}
        />
      )}
      <Tabs<Tab>
        label="Billing history"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'invoices', label: 'Invoices' },
          { value: 'payments', label: 'Payments' },
          { value: 'credits', label: 'Credits' },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'invoices' && (
          <InvoicesList key={epoch} canEdit={canEdit} onChanged={changed} onPay={setPaying} />
        )}
        {tab === 'payments' && <PaymentsList key={epoch} canEdit={canEdit} onChanged={changed} />}
        {tab === 'credits' && <CreditsList key={epoch} />}
      </div>
      {paying && (
        <PayDialog
          invoice={paying}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            changed();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div>
      <dt className="text-[12.5px] font-semibold text-muted">{label}</dt>
      <dd className={`text-[20px] font-bold tabular-nums ${tone === 'bad' ? 'text-bad' : ''}`}>{value}</dd>
    </div>
  );
}

function SummaryCard({
  s,
  nextInvoiceDate,
  canPay,
  busy,
  onPay,
}: {
  s: BillingSummary;
  nextInvoiceDate?: string | null;
  canPay: boolean;
  busy: boolean;
  onPay: () => void;
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[17px] font-bold">Summary</h3>
        {canPay && (
          <Button size="sm" onClick={onPay} loading={busy}>
            Pay now
          </Button>
        )}
      </div>
      {s.societyStatus === 'SUSPENDED' && (
        <Alert tone="bad">This society is suspended. Pay the overdue amount to restore service.</Alert>
      )}
      {s.nextSuspensionDate && s.societyStatus !== 'SUSPENDED' && (
        <Alert tone="warn">
          Service is suspended on {shortDate(s.nextSuspensionDate)} unless the overdue amount is paid.
        </Alert>
      )}
      {s.pendingManualPaymentPaise > 0 && (
        <Alert tone="info">
          A payment of {inr(s.pendingManualPaymentPaise)} is waiting for our approval.
        </Alert>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-5">
        <Stat label="Outstanding" value={inr(s.outstandingPaise)} />
        <Stat label="Overdue" value={inr(s.overduePaise)} tone={s.overduePaise > 0 ? 'bad' : undefined} />
        <Stat label="Credit balance" value={inr(s.creditBalancePaise)} />
        <Stat label="Next invoice" value={shortDate(nextInvoiceDate)} />
        <Stat label="Autopay" value={AUTOPAY_TEXT[s.autopayStatus] ?? s.autopayStatus} />
      </dl>
    </>
  );
}

function InvoicesList({
  canEdit,
  onChanged,
  onPay,
}: {
  canEdit: boolean;
  onChanged: () => void;
  onPay: (i: InvoiceListItem) => void;
}) {
  const phone = useIsPhone();
  const [openId, setOpenId] = useState<InvoiceListItem | null>(null);
  const list = useServerList(page => svc.invoices({ page, limit: 20 }), 'all');
  const payable = (r: InvoiceListItem) => canEdit && r.documentType === 'INVOICE' && isOpen(r.status);

  const sheet = openId && (
    <InvoiceSheet
      id={openId.id}
      title={openId.invoiceNo ?? 'Invoice'}
      canEdit={canEdit}
      onClose={() => setOpenId(null)}
      onChanged={() => {
        list.reload();
        onChanged();
      }}
    />
  );

  if (list.error)
    return (
      <ErrorState
        error={list.error}
        action={
          <Button size="sm" onClick={list.reload}>
            Try again
          </Button>
        }
      />
    );
  if (!list.loading && list.rows.length === 0)
    return <EmptyState title="No invoices yet" text="The first invoice is issued when the trial converts." />;

  if (phone)
    return (
      <>
        <ul className="flex flex-col gap-3" aria-label="Invoices">
          {list.rows.map(r => (
            <li key={r.id} className="glass p-4">
              <button
                type="button"
                className="block w-full text-left"
                onClick={() => setOpenId(r)}
                aria-label={`Open ${r.invoiceNo}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <b>{r.invoiceNo}</b>
                  <InvoiceStatusChip status={r.status} />
                </div>
                <div className="mt-1 text-[13px] text-muted">{periodText(r.periodStart, r.periodEnd)}</div>
                <div className="mt-2 flex justify-between text-[14px]">
                  <span>Total {inr(r.totalPaise)}</span>
                  <span>Due {inr(r.amountDuePaise)}</span>
                </div>
              </button>
              {payable(r) && (
                <Button size="sm" className="mt-3" onClick={() => onPay(r)}>
                  Pay
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
        {sheet}
      </>
    );

  const columns: Column<InvoiceListItem>[] = [
    { key: 'no', label: 'Invoice', render: r => <b>{r.invoiceNo}</b> },
    { key: 'period', label: 'Period', render: r => periodText(r.periodStart, r.periodEnd) },
    { key: 'total', label: 'Total', className: 'text-right tabular-nums', render: r => inr(r.totalPaise) },
    { key: 'due', label: 'Due', className: 'text-right tabular-nums', render: r => inr(r.amountDuePaise) },
    { key: 'st', label: 'Status', render: r => <InvoiceStatusChip status={r.status} /> },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      render: r =>
        payable(r) ? (
          <span onClick={e => e.stopPropagation()}>
            <Button size="xs" onClick={() => onPay(r)} aria-label={`Pay ${r.invoiceNo}`}>
              Pay
            </Button>
          </span>
        ) : null,
    },
  ];
  return (
    <>
      <DataTable
        caption="Invoices"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.loading}
        pageSize={20}
        onRowClick={setOpenId}
        rowLabel={r => r.invoiceNo ?? 'invoice'}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {sheet}
    </>
  );
}

function PaymentsList({ canEdit, onChanged }: { canEdit: boolean; onChanged: () => void }) {
  const list = useServerList(page => svc.payments({ page, limit: 20 }), 'all');
  const [cert, setCert] = useState<PaymentItem | null>(null);
  const columns: Column<PaymentItem>[] = [
    { key: 'kind', label: 'Type', render: r => KIND_LABEL[r.kind] ?? r.kind },
    { key: 'inv', label: 'Invoice', render: r => r.invoiceNo ?? '-' },
    {
      key: 'method',
      label: 'Method',
      render: r => (r.kind === 'TDS' ? `TDS ${r.tdsSection ?? ''}` : methodText(r.method)),
    },
    { key: 'amt', label: 'Amount', className: 'text-right tabular-nums', render: r => inr(r.amountPaise) },
    { key: 'date', label: 'Date', render: r => shortDate(r.receivedOn ?? r.capturedAt ?? r.createdAt) },
    { key: 'st', label: 'Status', render: r => <PaymentStatusChip status={r.status} /> },
    {
      key: 'act',
      label: 'Actions',
      hideLabel: true,
      render: r =>
        canEdit && r.kind === 'TDS' && r.status === 'CLAIMED' && !r.hasCertificate ? (
          <Button size="xs" variant="glass" onClick={() => setCert(r)}>
            Upload certificate
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      <DataTable
        caption="Payments, TDS claims and refunds"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pageSize={20}
        empty={{ title: 'No payments yet' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
      {cert && (
        <CertificateModal
          claim={cert}
          onClose={() => setCert(null)}
          onDone={() => {
            setCert(null);
            list.reload();
            onChanged();
          }}
        />
      )}
    </>
  );
}

const ENTRY_LABEL: Record<string, string> = {
  GOODWILL: 'Goodwill credit',
  REFUND: 'Refund',
  APPLIED: 'Applied to invoice',
  OVERPAYMENT: 'Overpayment',
  CREDIT_NOTE: 'Credit note',
};

function CreditsList() {
  const [balance, setBalance] = useState<number | null>(null);
  const list = useServerList(async page => {
    const r = await svc.credits({ page, limit: 20 });
    setBalance(r.balancePaise);
    return r;
  }, 'all');
  const columns: Column<CreditItem>[] = [
    {
      key: 'type',
      label: 'Entry',
      render: r => ENTRY_LABEL[r.entryType] ?? r.entryType.toLowerCase().replace(/_/g, ' '),
    },
    { key: 'inv', label: 'Invoice', render: r => r.invoiceNo ?? '-' },
    { key: 'amt', label: 'Amount', className: 'text-right tabular-nums', render: r => inr(r.amountPaise) },
    {
      key: 'bal',
      label: 'Balance after',
      className: 'text-right tabular-nums',
      render: r => inr(r.balanceAfterPaise),
    },
    { key: 'date', label: 'Date', render: r => shortDate(r.postedAt) },
    { key: 'why', label: 'Reason', render: r => r.reason ?? '-' },
  ];
  return (
    <>
      {balance !== null && (
        <p className="mb-3 text-[14px]">
          Credit balance <b className="tabular-nums">{inr(balance)}</b>. It is applied to your next invoice.
        </p>
      )}
      <DataTable
        caption="Credit ledger"
        columns={columns}
        rows={list.rows}
        rowKey={r => r.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        pageSize={20}
        empty={{ title: 'No credits yet' }}
      />
      <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
    </>
  );
}

function AutopayCard({
  status,
  canEdit,
  suspended,
  onChanged,
}: {
  status: string;
  canEdit: boolean;
  suspended: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [setup, setSetup] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [method, setMethod] = useState<'UPI_AUTOPAY' | 'EMANDATE'>('UPI_AUTOPAY');
  const [limit, setLimit] = useState('');
  const active = status === 'ACTIVE' || status === 'PENDING';
  const paise = rupeesToPaise(limit);
  return (
    <Card title="Autopay" sub="Let the invoice be paid automatically on the due date.">
      <p className="mb-3 flex items-center gap-2 text-[14px]">
        <Chip
          tone={
            status === 'ACTIVE'
              ? 'ok'
              : status === 'PENDING'
                ? 'info'
                : status === 'FAILED'
                  ? 'bad'
                  : 'neutral'
          }
        >
          {AUTOPAY_TEXT[status] ?? status}
        </Chip>
      </p>
      {canEdit && !active && !suspended && (
        <Button size="sm" onClick={() => setSetup(true)}>
          Set up UPI AutoPay or e-mandate
        </Button>
      )}
      {canEdit && active && (
        <Button size="sm" variant="danger-soft" onClick={() => setCancel(true)}>
          Cancel autopay
        </Button>
      )}
      {setup && (
        <FormModal
          title="Set up autopay"
          description="You will be taken to your bank or UPI app to approve it."
          submitLabel="Continue"
          onClose={() => setSetup(false)}
          onDone={() => {}}
          onSubmit={async () => {
            if (paise === null || paise < 100 || paise > 50_000_000_00)
              return { error: 'Enter a limit between ₹1 and ₹5,00,00,000.' };
            const r = await svc.startAutopay({ method, maxAmountPaise: paise });
            redirectTo(r.authUrl);
            return {};
          }}
        >
          <Select
            label="Method"
            value={method}
            onChange={e => setMethod(e.target.value as 'UPI_AUTOPAY' | 'EMANDATE')}
            options={[
              { value: 'UPI_AUTOPAY', label: 'UPI AutoPay' },
              { value: 'EMANDATE', label: 'e-mandate (bank account)' },
            ]}
          />
          <Input
            label="Highest amount per invoice (₹)"
            hint="At least your last invoice total."
            inputMode="decimal"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            required
          />
        </FormModal>
      )}
      {cancel && (
        <ConfirmReason
          open
          title="Cancel autopay?"
          description="Invoices will then need to be paid by hand."
          confirmLabel="Cancel autopay"
          onCancel={() => setCancel(false)}
          onConfirm={async () => {
            try {
              await svc.cancelAutopay();
              toast.show('Autopay cancelled.');
              setCancel(false);
              onChanged();
            } catch (e) {
              toast.show(billingError(e), 'error');
            }
          }}
        />
      )}
    </Card>
  );
}

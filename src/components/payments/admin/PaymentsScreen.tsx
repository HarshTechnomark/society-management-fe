'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Gate } from '@/components/setup/Gate';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { paymentsService } from '@/services/payments.service';
import type { PaymentItem, PaymentQuery } from '@/types/payments';
import { PaymentDrawer } from './PaymentDrawer';
import { RecordPaymentModal } from './RecordPaymentModal';
import { TodayCards } from './TodayCards';
import {
  METHOD_FILTERS,
  RECEIVED_STATUSES,
  STATUS_FILTERS,
  downloadBlob,
  methodLabel,
  paidFor,
  paymentError,
  plainError,
  statusInfo,
  type MethodFilter,
  type StatusFilter,
} from './format';

const P = PERMISSIONS.finance.payments;
const LIMIT = 20;

/** Build the list query from the two filter rows and the search box. */
export function buildQuery(
  method: MethodFilter,
  status: StatusFilter,
  q: string,
  page: number,
): PaymentQuery {
  const query: PaymentQuery = { page, limit: LIMIT };
  const text = q.trim();
  if (text.length >= 2) query.q = text;
  if (method === 'CHEQUES_PENDING') query.chequeStatus = 'PENDING';
  else if (method === 'NEFT') query.method = 'NEFT,IMPS,RTGS';
  else if (method !== 'ALL') query.method = method;
  if (status === 'REVIEW') query.needsReview = true;
  else if (status === 'RECEIVED') query.status = RECEIVED_STATUSES;
  else if (status !== 'ANY') query.status = status;
  return query;
}

/** Money > Payments (spec 11.1 and 11.2): today cards, live feed, filters, table, drawer, record payment. */
export function PaymentsScreen() {
  return (
    <Gate view={P.view} title="Payments">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(P.create);
  const canExport = usePermission(P.export);
  const chequesOn = useFeature('payments.cheque_lifecycle');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [method, setMethod] = useState<MethodFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ANY');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bump, setBump] = useState(0);
  const query = buildQuery(method, status, q, page);
  const key = JSON.stringify(query);
  const list = useLoad(() => paymentsService.list(query), key);

  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await paymentsService.exportCsv(query), 'payments.csv');
    } catch (e) {
      toast.show(paymentError(e), 'error');
    } finally {
      setExporting(false);
    }
  };
  const refresh = () => {
    list.reload();
    setBump(b => b + 1);
  };

  const data = list.data;
  return (
    <Page>
      <PageHead
        title="Payments"
        sub="Every payment and receipt: online, cash, cheque and bank transfer."
        actions={
          <>
            {chequesOn && (
              <Link href="/admin/payments/cheques" className={buttonClasses('glass', 'md')}>
                Cheques
              </Link>
            )}
            {canExport && (
              <Button variant="glass" loading={exporting} onClick={() => void exportCsv()}>
                Export CSV
              </Button>
            )}
            {canCreate && <Button onClick={() => setRecording(true)}>Record payment</Button>}
          </>
        }
      />
      <TodayCards reloadKey={bump} />
      <Card>
        <div className="mb-3">
          <input
            type="search"
            aria-label="Search receipt, flat, name or reference"
            placeholder="Search receipt, flat, name or reference"
            value={q}
            onChange={e => change(setQ)(e.target.value)}
            className="h-10 w-full rounded-full border-[1.5px] border-[rgba(20,35,44,0.16)] bg-white/80 px-4 text-[14px] focus:border-navy focus:outline-none sm:max-w-sm"
          />
        </div>
        <Segments label="Method" options={[...METHOD_FILTERS]} value={method} onChange={change(setMethod)} />
        <Segments label="Status" options={[...STATUS_FILTERS]} value={status} onChange={change(setStatus)} />
        {list.error != null ? (
          <ErrorState
            error={plainError(list.error)}
            action={
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto" data-testid="table-scroll">
            <table
              className="w-full min-w-[760px] border-collapse text-left text-[14px]"
              aria-busy={list.loading || undefined}
            >
              <caption className="sr-only">Payments</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {['Receipt', 'Flat', 'For', 'Method', 'Amount', 'Date', 'Status'].map(h => (
                    <th key={h} scope="col" className="px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.loading || !data
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} data-testid="skeleton-row" className="border-b border-[var(--line)]">
                        {Array.from({ length: 7 }, (_, c) => (
                          <td key={c} className="px-3 py-3.5">
                            <div className="skeleton h-4 w-full max-w-[120px]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : data.items.map(p => <Row key={p.id} p={p} onOpen={() => setOpenId(p.id)} />)}
              </tbody>
            </table>
          </div>
        )}
        {!list.loading && !list.error && data && data.items.length === 0 && (
          <EmptyState
            title="No payments here"
            text="Nothing matches these filters. Record a payment or change the filters."
          />
        )}
        {data && data.totalPages > 1 && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between gap-3 px-1 pt-3 text-[13px] text-muted"
          >
            <span>{data.total} payments</span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span aria-current="page">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </span>
          </nav>
        )}
      </Card>
      {openId !== null && <PaymentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
      {recording && <RecordPaymentModal onClose={() => setRecording(false)} onRecorded={refresh} />}
    </Page>
  );
}

function Row({ p, onOpen }: { p: PaymentItem; onOpen: () => void }) {
  const st = statusInfo(p.status, p.refundedPaise, p.amountPaise);
  return (
    <tr
      className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-white/50"
      onClick={onOpen}
    >
      <td className="px-3 py-3">
        <button
          type="button"
          className="text-left font-semibold"
          aria-label={`Open ${p.receiptNo ?? `payment ${p.id}`}`}
          onClick={e => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {p.receiptNo ?? 'Not issued'}
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="font-semibold">{p.unitLabel}</div>
        <div className="text-[12.5px] text-muted">{p.payerName}</div>
      </td>
      <td className="px-3 py-3">{paidFor(p)}</td>
      <td className="px-3 py-3">
        <Chip>{methodLabel(p.method)}</Chip>
      </td>
      <td className="px-3 py-3 font-semibold tabular-nums">{inr(p.amountPaise)}</td>
      <td className="px-3 py-3">{shortDate(p.paymentDate)}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Chip tone={st.tone}>{st.label}</Chip>
          {p.needsReview && <Chip tone="warn">Needs review</Chip>}
          {p.isDuplicateSuspect && <Chip tone="warn">Duplicate?</Chip>}
        </div>
      </td>
    </tr>
  );
}

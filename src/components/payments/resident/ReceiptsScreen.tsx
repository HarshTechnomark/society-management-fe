'use client';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { ResidentPayment } from '@/types/paymentsResident';
import { PayTabs } from './PayTabs';
import { METHOD_LABEL, PAYMENT_STATUS_LABEL, payError, plainPayError } from './format';

const monthLabel = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

/** Receipts (spec 11.3): my payments grouped by month, with a download for each receipt. */
export function ReceiptsScreen() {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="receipts">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const dues = useLoad(() => billingResidentService.dues(), 'dues');
  const [unit, setUnit] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad(
    () => svc.payments({ unitId: unit ? Number(unit) : undefined, page, limit: 30 }),
    `${unit}|${page}`,
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const units = dues.data ?? [];

  const groups = useMemo(() => {
    const m = new Map<string, ResidentPayment[]>();
    for (const p of list.data?.items ?? []) {
      const k = p.paymentDate.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [list.data]);

  const download = async (p: ResidentPayment) => {
    setBusy(p.id);
    setProblem(null);
    try {
      const r = await svc.receiptUrl(p.id);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      setProblem(payError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <PageHead title="Receipts" sub="Everything you paid, by month. Download a receipt any time." />
      <PayTabs />
      <Card>
        {units.length > 1 && (
          <div className="mb-3 max-w-xs">
            <Select
              label="Flat"
              value={unit}
              onChange={e => {
                setUnit(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All my flats' },
                ...units.map(u => ({ value: String(u.unitId), label: u.unitLabel })),
              ]}
            />
          </div>
        )}
        {problem && (
          <Alert tone="warn" className="mb-3">
            {problem}
          </Alert>
        )}
        {list.error != null ? (
          <ErrorState
            error={plainPayError(list.error)}
            action={
              <Button size="sm" onClick={list.reload}>
                Try again
              </Button>
            }
          />
        ) : list.loading ? (
          <div aria-busy="true" aria-label="Loading receipts">
            <div className="skeleton h-20 w-full" data-testid="skeleton-row" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState title="No payments yet" text="Your receipts appear here after you pay." />
        ) : (
          groups.map(([ym, rows]) => (
            <section key={ym} aria-label={monthLabel(ym)} className="mb-4">
              <h2 className="mb-1 text-[15px] font-bold">{monthLabel(ym)}</h2>
              <ul className="divide-y divide-[var(--line)]">
                {rows.map(p => (
                  <li
                    key={p.id}
                    data-testid="receipt-row"
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 text-[14.5px]">
                      <span className="block font-semibold">
                        {inr(p.grossAmountPaise)} · {METHOD_LABEL[p.method] ?? p.method}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {shortDate(p.paymentDate)} · {p.unitLabel}
                        {p.receiptNo ? ` · ${p.receiptNo}` : ''}
                      </span>
                      {p.status !== 'CAPTURED' && (
                        <Chip tone={p.status === 'CONFIRMED' ? 'ok' : 'warn'}>
                          {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                        </Chip>
                      )}
                    </span>
                    {p.receiptNo && (
                      <Button
                        size="sm"
                        variant="glass"
                        loading={busy === p.id}
                        aria-label={`Download receipt ${p.receiptNo}`}
                        onClick={() => download(p)}
                      >
                        Download
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        {(list.data?.totalPages ?? 1) > 1 && (
          <nav aria-label="Pages of receipts" className="flex items-center justify-between text-[13.5px]">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span>
              Page {page} of {list.data?.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (list.data?.totalPages ?? 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </Card>
    </Page>
  );
}

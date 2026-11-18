'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { downloadBlob } from '@/components/maintenance/ledger/format';
import { Segments } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { todayIST } from '@/lib/indiaDate';
import { noticesService } from '@/services/notices.service';
import type { Notice, ReceiptFilter, ReceiptQuery } from '@/types/notices';
import { dateTime, noticeError, pct, plainError } from './format';

function Meter({ label, part, whole }: { label: string; part: number; whole: number }) {
  const p = pct(part, whole);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted">
          {part} of {whole}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={p}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
      >
        <div className="h-full rounded-full bg-navy" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/** Read receipts of a published notice (spec 11.3): three meters, tower bars, and the table with filters and CSV. */
export function ReceiptsPanel({ notice, canExport }: { notice: Notice; canExport: boolean }) {
  const toast = useToast();
  const canUnreached = useFeature('communication.unreached_residents_follow_up');
  const [all, setAll] = useState(false);
  const [filter, setFilter] = useState<ReceiptFilter>('ALL');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const query: ReceiptQuery = { filter, page, limit: 20 };
  const load = useLoad(() => noticesService.receipts(notice.id, query), `${notice.id}:${filter}:${page}`);
  const s = load.data?.summary;

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(
        await noticesService.exportReceipts(notice.id, { filter }),
        `notice-${notice.number}-receipts-${todayIST()}.csv`,
      );
    } catch (e) {
      toast.show(noticeError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const filters: { key: ReceiptFilter; label: string }[] = [
    { key: 'ALL', label: 'Everyone' },
    { key: 'NOT_READ', label: 'Not read' },
    { key: 'NOT_ACKED', label: 'Not acknowledged' },
    ...(canUnreached ? [{ key: 'UNREACHED' as const, label: 'Unreached' }] : []),
  ];
  return (
    <section aria-label="Read receipts" className="mt-5">
      <h3 className="mb-2 text-[15px] font-bold">Read receipts</h3>
      {load.error != null && !load.data ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : !s ? (
        <div aria-busy="true" aria-label="Loading receipts" className="skeleton h-24 w-full" />
      ) : (
        <>
          <div className="grid gap-3">
            <Meter label="Reached" part={s.reached} whole={s.recipients} />
            <Meter label="Read" part={s.read} whole={s.recipients} />
            {notice.requiresAck && <Meter label="Acknowledged" part={s.acknowledged} whole={s.recipients} />}
          </div>
          {s.byBuilding.length > 0 && (
            <div className="mt-3" aria-label="By tower (read)">
              <p className="mb-1 text-[13px] font-semibold">By tower (read)</p>
              {s.byBuilding.map(b => (
                <div key={b.buildingId} className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                  <span className="w-16 shrink-0">{b.code}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]">
                    <div className="h-full bg-navy" style={{ width: `${pct(b.unitsRead, b.units)}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-muted">
                    {b.unitsRead}/{b.units}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!all ? (
            <Button className="mt-3" size="sm" variant="glass" onClick={() => setAll(true)}>
              View all
            </Button>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Segments
                  label="Receipt filters"
                  options={filters}
                  value={filter}
                  onChange={k => {
                    setFilter(k);
                    setPage(1);
                  }}
                />
                {canExport && (
                  <Button size="sm" variant="glass" loading={exporting} onClick={() => void exportCsv()}>
                    Export CSV
                  </Button>
                )}
              </div>
              {load.data && load.data.items.length === 0 ? (
                <EmptyState title="Nobody here" text="No receipts match this filter." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="text-muted">
                        <th className="py-1.5 pr-2">Flat</th>
                        <th className="pr-2">Name</th>
                        <th className="pr-2">Relation</th>
                        <th className="pr-2">Reached via</th>
                        <th className="pr-2">Read</th>
                        <th>Acknowledged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(load.data?.items ?? []).map(r => (
                        <tr key={r.receiptId} className="border-t border-[var(--line)]">
                          <td className="py-1.5 pr-2 font-semibold">{r.unitLabel}</td>
                          <td className="pr-2">
                            {r.name}
                            <span className="block text-[12px] text-muted">{r.mobile}</span>
                          </td>
                          <td className="pr-2">{r.relation}</td>
                          <td className="pr-2">{r.reachedVia ?? 'Unreached'}</td>
                          <td className="pr-2">{r.firstReadAt ? dateTime(r.firstReadAt) : '-'}</td>
                          <td>{r.acknowledgedAt ? dateTime(r.acknowledgedAt) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(load.data?.totalPages ?? 1) > 1 && (
                <nav aria-label="Pages of receipts" className="mt-2 flex items-center justify-between gap-2">
                  <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-[13px] text-muted">
                    Page {page} of {load.data?.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="glass"
                    disabled={page >= (load.data?.totalPages ?? 1)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

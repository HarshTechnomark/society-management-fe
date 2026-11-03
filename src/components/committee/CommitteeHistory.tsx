'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useLoad } from '@/hooks/useLoad';
import { shortDate } from '@/lib/money';
import { committeeService } from '@/services/committee.service';
import { Empty, Loading, Section } from '@/components/residents/common';
import type { Term, TermListItem } from '@/types/committee';
import { SeatCard } from './SeatCard';
import {
  DESIGNATION_LABEL,
  DESIGNATION_ORDER,
  KIND_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from './format';

const LIMIT = 10;

/** Past committees, newest first (spec 11.7), with a read-only term detail. */
export function CommitteeHistory({ onBack }: { onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const load = useLoad(
    () =>
      committeeService.terms({ status: 'ENDED', sortBy: 'startDate', sortOrder: 'desc', page, limit: LIMIT }),
    page,
  );
  if (open !== null) return <TermDetail id={open} onBack={() => setOpen(null)} />;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[20px] font-bold">Past committees</h2>
        <Button variant="glass" size="sm" onClick={onBack}>
          Back to committee
        </Button>
      </div>
      <Loading load={load} rows={3}>
        {r =>
          r.items.length === 0 ? (
            <Card>
              <Empty
                title="No past committees yet"
                text="Earlier committees appear here after a new committee takes charge, or when you record a past committee."
              />
            </Card>
          ) : (
            <>
              <ol className="relative ml-2 border-l-2 border-[var(--line)] pl-4" aria-label="Past committees">
                {r.items.map(t => (
                  <TermItem key={t.id} t={t} onOpen={() => setOpen(t.id)} />
                ))}
              </ol>
              {r.pagination && r.pagination.totalPages > 1 && (
                <nav aria-label="Pages" className="mt-3 flex items-center justify-center gap-3 text-[13.5px]">
                  <Button size="xs" variant="glass" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span>
                    Page {r.pagination.page} of {r.pagination.totalPages}
                  </span>
                  <Button
                    size="xs"
                    variant="glass"
                    disabled={page >= r.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )
        }
      </Loading>
    </div>
  );
}

function TermItem({ t, onOpen }: { t: TermListItem; onOpen: () => void }) {
  const bearers = [...t.officeBearers].sort(
    (a, b) => DESIGNATION_ORDER.indexOf(a.designation) - DESIGNATION_ORDER.indexOf(b.designation),
  );
  return (
    <li className="glass mb-3 p-4" data-testid="history-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold">{t.name}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
            <Chip tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Chip>
            <Chip>{SOURCE_LABEL[t.source]}</Chip>
            <span>
              {shortDate(t.startDate)} to {shortDate(t.actualEndDate ?? t.endDate)}
            </span>
          </p>
        </div>
        <Button size="xs" variant="glass" onClick={onOpen} aria-label={`View ${t.name}`}>
          View
        </Button>
      </div>
      {t.tookChargeOn && (
        <p className="mt-2 text-[13.5px]">
          <span className="text-muted">Took charge on</span> {shortDate(t.tookChargeOn)}
        </p>
      )}
      {bearers.length > 0 && (
        <ul className="mt-2 grid gap-x-6 gap-y-0.5 text-[14px] sm:grid-cols-2">
          {bearers.map(b => (
            <li key={`${b.designation}-${b.name}`}>
              <span className="text-muted">{DESIGNATION_LABEL[b.designation]}:</span>{' '}
              <span className="font-semibold">{b.name}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function TermDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const load = useLoad(() => committeeService.term(id), id);
  return (
    <div>
      <div className="mb-3">
        <Button variant="glass" size="sm" onClick={onBack}>
          Back to past committees
        </Button>
      </div>
      <Loading load={load} rows={3}>
        {t => <Detail t={t} />}
      </Loading>
    </div>
  );
}

function Detail({ t }: { t: Term }) {
  const order = (a: Term['seats'][number], b: Term['seats'][number]) =>
    DESIGNATION_ORDER.indexOf(a.designation) - DESIGNATION_ORDER.indexOf(b.designation);
  const now = t.seats.filter(s => s.status !== 'LEFT').sort(order);
  const left = t.seats.filter(s => s.status === 'LEFT').sort(order);
  return (
    <>
      <Card className="mb-4">
        <h2 className="text-[19px] font-bold">{t.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
          <Chip tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Chip>
          <Chip>{SOURCE_LABEL[t.source]}</Chip>
          <Chip>{KIND_LABEL[t.kind]}</Chip>
          <span>
            {shortDate(t.startDate)} to {shortDate(t.actualEndDate ?? t.endDate)}
          </span>
        </p>
        <dl className="mt-3 text-[14px]">
          {t.tookChargeOn && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Took charge on</dt>
              <dd className="font-semibold">{shortDate(t.tookChargeOn)}</dd>
            </div>
          )}
          {t.resolutionRef && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Resolution</dt>
              <dd className="font-semibold">{t.resolutionRef}</dd>
            </div>
          )}
        </dl>
        {t.notes && <p className="mt-2 text-[14px]">{t.notes}</p>}
      </Card>
      {now.length > 0 && (
        <Section title="Seats">
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Seats">
            {now.map(s => (
              <SeatCard key={s.seatId} seat={s} history />
            ))}
          </ul>
        </Section>
      )}
      {left.length > 0 && (
        <Section title="Left the committee">
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Seats that were left">
            {left.map(s => (
              <SeatCard key={s.seatId} seat={s} history />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

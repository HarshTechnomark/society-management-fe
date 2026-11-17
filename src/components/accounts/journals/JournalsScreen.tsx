'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { buttonClasses, Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsJournalService } from '@/services/accountsJournal.service';
import { JournalDrawer } from './JournalDrawer';
import { STATUS_LABEL, STATUS_TONE, VOUCHER_LABEL, plainError } from './format';

const P = PERMISSIONS.finance.accounts;
const opt = (all: string, m: Record<string, string>) => [
  { value: '', label: all },
  ...Object.entries(m).map(([value, label]) => ({ value, label })),
];

/** Journals (spec 8.11, 11.7): every posting, system and manual, with filters and a voucher drawer. */
export function JournalsScreen() {
  return (
    <Gate view={P.view} feature="accounting.journal_engine" title="Journals">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(P.create);
  const manualOn = useFeature('accounting.manual_journals');
  const [f, setF] = useState({ q: '', from: '', to: '', status: '', source: '', voucherType: '' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const set = (k: keyof typeof f) => (v: string) => {
    setF(s => ({ ...s, [k]: v }));
    setPage(1);
  };
  const q = f.q.trim();
  const load = useLoad(
    () =>
      accountsJournalService.journals({
        page,
        limit: 20,
        q: q.length >= 2 ? q : undefined,
        from: f.from || undefined,
        to: f.to || undefined,
        status: f.status || undefined,
        source: f.source || undefined,
        voucherType: f.voucherType || undefined,
      }),
    `${page}|${q.length >= 2 ? q : ''}|${f.from}|${f.to}|${f.status}|${f.source}|${f.voucherType}`,
  );
  const items = load.data?.items ?? [];
  const pg = load.data?.pagination;
  const filtered = !!(q || f.from || f.to || f.status || f.source || f.voucherType);

  return (
    <Page>
      <PageHead
        title="Journals"
        sub="Every entry in the books, the ones the system posts and the ones made by hand."
        actions={
          canCreate &&
          manualOn && (
            <Link href="/admin/accounts/journals/new" className={buttonClasses('primary', 'md')}>
              New journal
            </Link>
          )
        }
      />
      <Card>
        <div className="mb-3 grid gap-x-3 sm:grid-cols-3 lg:grid-cols-6">
          <Input
            label="Search"
            type="search"
            placeholder="Number or narration"
            value={f.q}
            onChange={e => set('q')(e.target.value)}
          />
          <Input label="From" type="date" value={f.from} onChange={e => set('from')(e.target.value)} />
          <Input label="To" type="date" value={f.to} onChange={e => set('to')(e.target.value)} />
          <Select
            label="Status"
            value={f.status}
            onChange={e => set('status')(e.target.value)}
            options={opt('All statuses', STATUS_LABEL)}
          />
          <Select
            label="Made by"
            value={f.source}
            onChange={e => set('source')(e.target.value)}
            options={opt('System and manual', { SYSTEM: 'System', MANUAL: 'Manual' })}
          />
          <Select
            label="Type"
            value={f.voucherType}
            onChange={e => set('voucherType')(e.target.value)}
            options={opt('All types', VOUCHER_LABEL)}
          />
        </div>
        {load.loading && <div className="skeleton h-40 w-full" data-testid="journals-loading" />}
        {!load.loading && load.error != null && (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={() => load.reload()}>
                Try again
              </Button>
            }
          />
        )}
        {!load.loading && !load.error && items.length === 0 && (
          <EmptyState
            title={filtered ? 'No journals match' : 'No journals yet'}
            text={filtered ? 'Change the filters.' : 'Entries appear here as the society posts them.'}
          />
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-[var(--line)]" aria-label="Journals">
            {items.map(j => (
              <li
                key={j.id}
                data-testid="journal-row"
                className="grid gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[10rem_6rem_6rem_1fr_7rem_5rem_9rem] min-[900px]:items-center"
              >
                <button
                  type="button"
                  className="text-left text-[14.5px] font-bold underline-offset-2 hover:underline"
                  aria-label={`Open ${j.voucherNo ?? `draft ${j.id}`}`}
                  onClick={() => setOpenId(j.id)}
                >
                  {j.voucherNo ?? `Draft ${j.id}`}
                </button>
                <span className="text-[13.5px] text-muted">{shortDate(j.entryDate)}</span>
                <span className="text-[13.5px]">{VOUCHER_LABEL[j.voucherType] ?? j.voucherType}</span>
                <span className="min-w-0 truncate text-[14px]">{j.narration}</span>
                <span className="text-[14px] font-semibold tabular-nums">{inr(j.totalPaise)}</span>
                <span>
                  <Chip tone={j.source === 'SYSTEM' ? 'info' : 'gold'}>
                    {j.source === 'SYSTEM' ? 'System' : 'Manual'}
                  </Chip>
                </span>
                <span>
                  <Chip tone={STATUS_TONE[j.status] ?? 'neutral'}>{STATUS_LABEL[j.status] ?? j.status}</Chip>
                </span>
              </li>
            ))}
          </ul>
        )}
        {pg && pg.totalPages > 1 && (
          <nav className="mt-3 flex items-center justify-between text-[13.5px]" aria-label="Pages">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              Page {pg.page} of {pg.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= pg.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </Card>
      {openId !== null && (
        <JournalDrawer id={openId} onClose={() => setOpenId(null)} onChanged={load.reload} />
      )}
    </Page>
  );
}

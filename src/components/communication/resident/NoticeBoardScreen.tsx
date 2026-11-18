'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { residentNoticesService as svc } from '@/services/residentNotices.service';
import { istDate, plainCommError } from '../format';
import { NOTICE_CATEGORIES } from './format';
import { NoticeCard } from './NoticeCard';

/** Spec 11.7 notice board: pinned carousel, list with unread dots, category filter, search, open surveys. */
export function NoticeBoardScreen() {
  return (
    <Gate view={PERMISSIONS.resident.notices.view} title="Notices">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [category, setCategory] = useState('');
  const [unread, setUnread] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const term = q.trim().length >= 2 ? q.trim() : '';
  const key = `${category}|${unread}|${term}|${page}`;
  const list = useLoad(
    () =>
      svc.notices({
        category: category || undefined,
        unread: unread || undefined,
        q: term || undefined,
        page,
        limit: 20,
      }),
    key,
  );
  const surveys = useLoad(() => svc.surveys().catch(() => []), 'surveys');
  const open = (surveys.data ?? []).filter(s => !s.responded);
  const items = list.data?.items ?? [];
  const pinned = page === 1 && !category && !unread && !term ? items.filter(n => n.isPinned) : [];
  const rest = items.filter(n => !pinned.includes(n));
  const pill = (on: boolean) =>
    cx(
      'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
      on ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
    );
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  return (
    <Page>
      <PageHead title="Notices" sub="What your society has told you." />
      {open.length > 0 && (
        <Card title="Surveys for you" className="mb-4">
          <ul className="grid gap-2">
            {open.map(s => (
              <li key={s.id}>
                <Link
                  href={`/resident/surveys/${s.id}`}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-white/60 p-3 hover:bg-white/90"
                >
                  <span className="text-[15px] font-semibold">{s.title}</span>
                  <Chip tone="gold">{s.closesAt ? `Closes ${istDate(s.closesAt)}` : 'Open'}</Chip>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {pinned.length > 0 && (
        <section aria-label="Pinned notices" className="mb-4">
          <ul className="flex gap-2.5 overflow-x-auto pb-1">
            {pinned.map(n => (
              <li key={n.id} className="w-[270px] shrink-0">
                <Link
                  href={`/resident/notices/${n.id}`}
                  className="block h-full rounded-2xl bg-[rgba(201,169,97,0.25)] p-3.5"
                >
                  <Chip tone="gold">Pinned</Chip>
                  <p className="mt-1.5 text-[15px] font-bold">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{n.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Card>
        <Input
          label="Search notices"
          type="search"
          value={q}
          onChange={e => reset(setQ)(e.target.value)}
          placeholder="At least 2 letters"
        />
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Category">
          {NOTICE_CATEGORIES.map(c => (
            <button
              key={c.value}
              className={pill(category === c.value)}
              aria-pressed={category === c.value}
              onClick={() => reset(setCategory)(c.value)}
            >
              {c.label}
            </button>
          ))}
          <button className={pill(unread)} aria-pressed={unread} onClick={() => reset(setUnread)(!unread)}>
            Unread only
          </button>
        </div>
        {list.loading ? (
          <div className="skeleton h-28 w-full" />
        ) : list.error ? (
          <ErrorState
            error={plainCommError(list.error)}
            action={<Button onClick={list.reload}>Try again</Button>}
          />
        ) : items.length === 0 ? (
          <EmptyState title="No notices" text="Nothing matches this view." />
        ) : (
          <ul className="grid gap-2.5">
            {rest.map(n => (
              <NoticeCard key={n.id} n={n} />
            ))}
          </ul>
        )}
        {(list.data?.pages ?? 1) > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {list.data?.pages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (list.data?.pages ?? 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </Page>
  );
}

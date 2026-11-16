'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/common/PageHead';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr } from '@/lib/money';
import { paymentsService } from '@/services/payments.service';
import { WHAT_LABEL, methodLabel, plainError } from './format';

function Tile({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  const body = (
    <>
      <div className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[24px] font-bold tabular-nums">{value}</div>
      {note && <div className="text-[13px] text-muted">{note}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="glass block p-4" data-testid="kpi">
      {body}
    </Link>
  ) : (
    <div className="glass p-4" data-testid="kpi">
      {body}
    </div>
  );
}

/** The Today cards of spec 11.2 owned by module 12: collected today, this month with efficiency, live payments. */
export function TodayCards({ pollMs = 30_000, reloadKey = 0 }: { pollMs?: number; reloadKey?: number }) {
  const canView = usePermission(PERMISSIONS.finance.payments.view);
  const on = useFeature('payments.instant_payment_to_society_balance');
  if (!canView || !on) return null;
  return <Cards pollMs={pollMs} reloadKey={reloadKey} />;
}

function Cards({ pollMs, reloadKey }: { pollMs: number; reloadKey: number }) {
  const summary = useLoad(() => paymentsService.summary(), reloadKey);
  const feed = useLoad(() => paymentsService.liveFeed(), reloadKey);
  const toast = useToast();
  const seen = useRef<Set<number> | null>(null);
  const { reload: reloadFeed } = feed;
  const { reload: reloadSummary } = summary;

  // no socket here yet: look again every 30 seconds and say so when a payment came in
  useEffect(() => {
    const t = window.setInterval(() => {
      reloadFeed();
      reloadSummary();
    }, pollMs);
    return () => window.clearInterval(t);
  }, [pollMs, reloadFeed, reloadSummary]);

  useEffect(() => {
    if (!feed.data) return;
    if (seen.current) {
      const fresh = feed.data.filter(i => !seen.current!.has(i.id)).slice(0, 3);
      for (const i of fresh)
        toast.show(`${i.unitLabel} paid ${inr(i.amountPaise)} (${WHAT_LABEL[i.what] ?? i.what})`);
    }
    seen.current = new Set(feed.data.map(i => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data]);

  const s = summary.data;
  const mix = s ? Object.entries(s.month.byMethod).sort((a, b) => b[1] - a[1]) : [];
  const monthTotal = s?.month.collectedPaise ?? 0;
  return (
    <section aria-label="Today" className="mb-5">
      {summary.error != null && !s ? (
        <Card>
          <ErrorState error={plainError(summary.error)} />
        </Card>
      ) : !s ? (
        <div aria-busy="true" aria-label="Loading" className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skeleton h-24 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <Tile
              label="Collected today"
              value={inr(s.today.collectedPaise)}
              note={`${s.today.count} ${s.today.count === 1 ? 'payment' : 'payments'}`}
              href="/admin/payments"
            />
            <Tile
              label="This month"
              value={inr(s.month.collectedPaise)}
              note={
                s.efficiency
                  ? `${s.efficiency.percent}% of billed collected`
                  : `${s.month.count} ${s.month.count === 1 ? 'payment' : 'payments'}`
              }
            />
            <Tile
              label="Waiting for approval"
              value={String(s.pendingApprovalCount)}
              note={s.needsReviewCount > 0 ? `${s.needsReviewCount} need review` : undefined}
            />
            <Tile
              label="Cheques in clearing"
              value={inr(s.chequesInClearing.amountPaise)}
              note={`${s.chequesInClearing.count} ${s.chequesInClearing.count === 1 ? 'cheque' : 'cheques'}`}
              href="/admin/payments/cheques"
            />
          </div>
          {mix.length > 0 && monthTotal > 0 && (
            <Card title="This month by method" className="mt-3">
              <ul className="grid gap-2" data-testid="method-mix">
                {mix.map(([m, paise]) => (
                  <li key={m}>
                    <div className="flex justify-between text-[14px]">
                      <span>{methodLabel(m)}</span>
                      <strong className="tabular-nums">
                        {inr(paise)} ({Math.round((paise / monthTotal) * 100)}%)
                      </strong>
                    </div>
                    <div
                      className="mt-1 h-2 overflow-hidden rounded-full bg-black/10"
                      role="meter"
                      aria-label={methodLabel(m)}
                      aria-valuemin={0}
                      aria-valuemax={monthTotal}
                      aria-valuenow={paise}
                      aria-valuetext={inr(paise)}
                    >
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{ width: `${Math.max(3, (paise / monthTotal) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      <section className="glass mt-3 p-4 sm:p-5" aria-labelledby="live-title">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="live-title" className="text-[17px] font-bold">
              Live payments
            </h2>
            <p className="text-[13px] text-muted">The latest payments as they come in</p>
          </div>
          <Chip tone="ok">Live</Chip>
        </div>
        {feed.error != null && !feed.data ? (
          <ErrorState error={plainError(feed.error)} />
        ) : !feed.data ? (
          <div className="skeleton h-16 w-full" data-testid="skeleton-row" />
        ) : feed.data.length === 0 ? (
          <p className="text-[14px] text-muted">No payment yet today. New payments show up here.</p>
        ) : (
          <ul className="grid gap-1.5 text-[14px]" data-testid="live-feed">
            {feed.data.slice(0, 10).map(i => (
              <li key={i.id} className="flex flex-wrap justify-between gap-2" data-testid="feed-item">
                <span>
                  <strong>{i.unitLabel}</strong> paid {inr(i.amountPaise)} ({WHAT_LABEL[i.what] ?? i.what}) by{' '}
                  {methodLabel(i.method)}
                </span>
                <span className="text-muted">{i.receiptNo ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

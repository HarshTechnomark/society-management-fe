'use client';
import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card } from '@/components/common/PageHead';
import { Button } from '@/components/ui/Button';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsBalanceService as svc } from '@/services/accountsBalance.service';
import type { SocietyBalance } from '@/types/accountsBalance';
import { BalanceChart } from './BalanceChart';
import { plainBalanceError, timeOf, ymd } from './format';

/** Today card "Society balance" (spec 11.1). Hidden without `finance.accounts.view`. Looks again every 30 seconds (no socket client yet). */
export function SocietyBalanceCard({
  pollMs = 30_000,
  className = 'mb-4',
}: {
  pollMs?: number;
  className?: string;
}) {
  const can = usePermission(PERMISSIONS.finance.accounts.view);
  if (!can) return null;
  return <Inner pollMs={pollMs} className={className} />;
}

function Chip2({ label, note, paise }: { label: string; note: string; paise: number | null }) {
  return (
    <div className="rounded-xl bg-[rgba(20,35,44,0.05)] px-3 py-2" data-testid="balance-chip">
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className="text-[16px] font-bold">{paise === null ? '-' : inr(paise)}</p>
      <p className="text-[12px] text-muted">{note}</p>
    </div>
  );
}

function Inner({ pollMs, className }: { pollMs: number; className: string }) {
  const bal = useLoad(() => svc.balance(true));
  const { reload } = bal;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = window.setInterval(reload, pollMs);
    return () => window.clearInterval(t);
  }, [pollMs, reload]);
  const b = bal.data;
  const [bump, setBump] = useState(false);
  const total = b?.totalPaise;
  useEffect(() => {
    if (total === undefined) return;
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 600);
    return () => window.clearTimeout(t);
  }, [total]);

  return (
    <Card title="Society balance" className={className}>
      {b === null && bal.loading ? (
        <div aria-busy="true" aria-label="Loading society balance">
          <div className="skeleton h-16 w-full" data-testid="skeleton-row" />
        </div>
      ) : b === null ? (
        <ErrorState
          error={plainBalanceError(bal.error)}
          title="The society balance could not be loaded"
          action={
            <Button size="sm" onClick={reload}>
              Try again
            </Button>
          }
        />
      ) : (
        <Body b={b} bump={bump} open={open} onToggle={() => setOpen(o => !o)} />
      )}
    </Card>
  );
}

function Body({
  b,
  bump,
  open,
  onToggle,
}: {
  b: SocietyBalance;
  bump: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const bank = b.bankAccounts[0];
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p
          className={`text-[30px] font-bold tracking-tight transition-transform ${bump ? 'scale-105' : ''}`}
          data-testid="balance-total"
          aria-live="polite"
        >
          {inr(b.totalPaise)}
        </p>
        <span className="rounded-full bg-[#dff0e4] px-2 py-0.5 text-[12px] font-semibold text-[#1f6b3a]">
          Live
        </span>
        <span className="text-[12.5px] text-muted">Updated {timeOf(b.lastChangedAt)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Chip2
          label="In bank"
          paise={b.inBankPaise}
          note={bank ? `${bank.bankName} ${bank.maskedNumber}` : 'No bank yet'}
        />
        <Chip2 label="Reaching bank" paise={b.clearingPaise} note="UPI and card, settles next working day" />
        <Chip2 label="Cash in hand" paise={b.cashPaise} note="With treasurer" />
        <Chip2 label="Cheques in clearing" paise={b.chequesPaise} note="Deposited, not cleared" />
      </div>
      <ul aria-label="Recent movements" className="mt-3 flex flex-col gap-1">
        {b.movements.slice(0, 4).map(m => (
          <li key={m.journalEntryId} className="flex justify-between gap-2 text-[13.5px]">
            <span className="min-w-0 truncate">{m.label}</span>
            <span
              className={
                m.direction === 'UP' ? 'text-[#1f6b3a]' : m.direction === 'DOWN' ? 'text-bad' : 'text-muted'
              }
            >
              {m.direction === 'UP' ? '+' : ''}
              {m.direction === 'MOVE' ? 'Moved' : inr(m.deltaTotalPaise)}
            </span>
          </li>
        ))}
        {b.movements.length === 0 && <li className="text-[13.5px] text-muted">No movements yet.</li>}
      </ul>
      <button
        type="button"
        className="mt-3 text-[13.5px] font-semibold underline"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && <Details b={b} />}
    </div>
  );
}

function Details({ b }: { b: SocietyBalance }) {
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { from: ymd(from), to: ymd(to) };
  }, []);
  const hist = useLoad(() => svc.history(range.from, range.to));
  return (
    <div className="mt-3 flex flex-col gap-4" data-testid="balance-details">
      <section aria-label="Bank accounts">
        <h3 className="text-[14.5px] font-bold">Bank accounts</h3>
        {b.bankAccounts.length === 0 ? (
          <p className="text-[13.5px] text-muted">No bank account yet.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {b.bankAccounts.map(a => (
              <li key={a.id} className="text-[13.5px]">
                <span className="flex justify-between gap-2">
                  <span>
                    {a.displayName} {a.maskedNumber}
                  </span>
                  <strong>{inr(a.balancePaise)}</strong>
                </span>
                <span className="text-[12.5px] text-muted">
                  {a.lastReconciledDate
                    ? `Last reconciled ${shortDate(a.lastReconciledDate)}`
                    : 'Not reconciled yet'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Funds">
        <h3 className="text-[14.5px] font-bold">Funds</h3>
        <ul className="mt-1 flex flex-col gap-1">
          {b.funds.map(f => (
            <li key={f.id} className="flex justify-between gap-2 text-[13.5px]">
              <span>{f.name}</span>
              <strong>{inr(f.balancePaise)}</strong>
            </li>
          ))}
          <li className="flex justify-between gap-2 text-[13.5px]">
            <span>General (not earmarked)</span>
            <strong>{inr(b.generalPaise)}</strong>
          </li>
        </ul>
      </section>
      <section aria-label="All movements">
        <h3 className="text-[14.5px] font-bold">Last movements</h3>
        <ul className="mt-1 flex flex-col gap-1">
          {b.movements.map(m => (
            <li key={m.journalEntryId} className="flex justify-between gap-2 text-[13px]">
              <span className="min-w-0">
                {m.label} <span className="text-muted">{shortDate(m.changedAt)}</span>
              </span>
              <span>{inr(m.totalPaise)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Last 30 days">
        <h3 className="text-[14.5px] font-bold">Last 30 days</h3>
        {hist.loading ? (
          <div className="skeleton h-28 w-full" />
        ) : hist.error != null ? (
          <p role="alert" className="text-[13.5px] text-muted">
            The chart could not be loaded.{' '}
            <button type="button" className="font-semibold underline" onClick={hist.reload}>
              Try again
            </button>
          </p>
        ) : (
          <BalanceChart points={hist.data ?? []} />
        )}
      </section>
    </div>
  );
}

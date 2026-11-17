'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { accountsPeriodsService } from '@/services/accountsPeriods.service';
import type { YearRow } from '@/types/accountsPeriods';
import { CloseYearDialog } from './CloseYearDialog';
import { LockDialog } from './LockDialog';
import { UnlockRequestDialog } from './UnlockRequestDialog';
import { periodsError } from './format';

const A = PERMISSIONS.finance.accounts;

/** Periods and year close (spec 8.18, 11.7): lock state, unlock request, relock, financial years. */
export function PeriodsScreen() {
  return (
    <Gate view={A.view} title="Periods and year close">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const toast = useToast();
  const canApprove = usePermission(A.approve);
  const canCreate = usePermission(A.create);
  const lockOn = useFeature('accounting.periods_and_locking');
  const closeOn = useFeature('accounting.year_end_closing');
  const load = useLoad(() => accountsPeriodsService.get(), 'periods');
  const [dialog, setDialog] = useState<'lock' | 'unlock' | null>(null);
  const [closing, setClosing] = useState<YearRow | null>(null);
  const [relocking, setRelocking] = useState(false);
  const [asked, setAsked] = useState(false);
  const p = load.data;

  const relock = async () => {
    if (!p) return;
    setRelocking(true);
    try {
      await accountsPeriodsService.relock(p.version);
      toast.show('Books locked again.');
      load.reload();
    } catch (e) {
      toast.show(periodsError(e));
    } finally {
      setRelocking(false);
    }
  };

  return (
    <Page>
      <PageHead
        title="Periods and year close"
        sub="Lock finished months so nobody can change them, and close each financial year."
        actions={
          canApprove && lockOn && p && <Button onClick={() => setDialog('lock')}>Lock books up to</Button>
        }
      />
      {load.error != null ? (
        <ErrorState
          error={new Error(periodsError(load.error))}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : load.loading || !p ? (
        <div aria-busy="true" aria-label="Loading">
          <div className="skeleton mb-3 h-24 w-full" data-testid="skeleton-row" />
          <div className="skeleton h-24 w-full" />
        </div>
      ) : (
        <div className="grid gap-4">
          <Card title="Lock state">
            <div className="flex flex-wrap items-center gap-2" data-testid="lock-state">
              {p.booksLockedThrough ? (
                <Chip tone="gold">Locked through {shortDate(p.booksLockedThrough)}</Chip>
              ) : (
                <Chip tone="neutral">No month is locked</Chip>
              )}
              {p.unlock && (
                <Chip tone="warn">
                  Temporarily open from {shortDate(p.unlock.fromDate)} until {shortDate(p.unlock.until)}
                </Chip>
              )}
              {!p.unlock && (p.pendingUnlock || asked) && (
                <Chip tone="info">Unlock waiting for approval</Chip>
              )}
            </div>
            {p.pendingUnlock && !p.unlock && (
              <p className="mt-2 text-[13.5px] text-muted">
                Request to open from {shortDate(p.pendingUnlock.fromDate)} for {p.pendingUnlock.hours} hours:{' '}
                {p.pendingUnlock.reason}
              </p>
            )}
            {!lockOn && (
              <p className="mt-2 text-[13.5px] text-muted">
                Locking books is part of the Premium plan. You can still see the state here.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {lockOn && canCreate && p.booksLockedThrough && !p.unlock && !p.pendingUnlock && !asked && (
                <Button variant="glass" size="sm" onClick={() => setDialog('unlock')}>
                  Request unlock
                </Button>
              )}
              {lockOn && canApprove && p.unlock && (
                <Button variant="glass" size="sm" loading={relocking} onClick={() => void relock()}>
                  Relock
                </Button>
              )}
            </div>
          </Card>
          <Card title="Financial years">
            {p.years.length === 0 ? (
              <p className="text-[14px] text-muted">No financial year has entries yet.</p>
            ) : (
              <ul aria-label="Financial years" className="divide-y divide-[var(--line)]">
                {p.years.map(y => (
                  <li key={y.financialYear} data-testid="year-row" className="grid gap-1 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-bold">{y.financialYear}</span>
                        <span className="text-[13px] text-muted">
                          {shortDate(y.start)} to {shortDate(y.end)}
                        </span>
                        <Chip tone={y.status === 'CLOSED' ? 'neutral' : 'ok'}>
                          {y.status === 'CLOSED' ? 'Closed' : 'Open'}
                        </Chip>
                      </div>
                      {y.status === 'OPEN' && canApprove && closeOn && (
                        <Button size="xs" variant="glass" onClick={() => setClosing(y)}>
                          Close year
                        </Button>
                      )}
                    </div>
                    {y.status === 'OPEN' && y.blockers.length > 0 && (
                      <ul className="list-disc pl-5 text-[13px] text-muted">
                        {y.blockers.map(b => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!closeOn && (
              <p className="mt-2 text-[13.5px] text-muted">Closing a year is part of the Premium plan.</p>
            )}
          </Card>
        </div>
      )}
      {dialog === 'lock' && p && (
        <LockDialog
          lockedThrough={p.booksLockedThrough}
          version={p.version}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load.reload();
          }}
        />
      )}
      {dialog === 'unlock' && p && (
        <UnlockRequestDialog
          maxHours={p.maxUnlockHours}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setAsked(true);
            load.reload();
          }}
        />
      )}
      {closing && p && (
        <CloseYearDialog
          year={closing}
          version={p.version}
          onClose={() => setClosing(null)}
          onDone={load.reload}
        />
      )}
    </Page>
  );
}

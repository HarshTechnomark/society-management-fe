'use client';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeatureState } from '@/lib/entitlements';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import { HelpTabs } from './HelpTabs';
import { IssueRowCard } from './IssueRowCard';
import { plainHelpError } from './format';

/** Building issues of my society (spec 8.24): near me, or the whole board when the plan has it. */
export function IssuesBoardScreen() {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.view} title="Help">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const boardOk = useFeatureState('helpdesk.public_community_issue_board');
  const [scopePick, setScope] = useState<'NEAR_ME' | 'ALL'>('NEAR_ME');
  const scope = boardOk ? scopePick : 'NEAR_ME';
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const list = useLoad(() => svc.buildingIssues({ scope, status, limit: 50 }), `${scope}|${status}`);
  const pill = (on: boolean) =>
    cx(
      'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
      on ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
    );
  return (
    <Page>
      <PageHead title="Building issues" sub="What is reported in your society and how it is going." />
      <HelpTabs />
      <Card>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            className={pill(scope === 'NEAR_ME')}
            aria-pressed={scope === 'NEAR_ME'}
            onClick={() => setScope('NEAR_ME')}
          >
            Near me
          </button>
          {boardOk && (
            <button
              className={pill(scope === 'ALL')}
              aria-pressed={scope === 'ALL'}
              onClick={() => setScope('ALL')}
            >
              All issues
            </button>
          )}
          <span className="w-2" />
          <button
            className={pill(status === 'OPEN')}
            aria-pressed={status === 'OPEN'}
            onClick={() => setStatus('OPEN')}
          >
            Open
          </button>
          <button
            className={pill(status === 'RESOLVED')}
            aria-pressed={status === 'RESOLVED'}
            onClick={() => setStatus('RESOLVED')}
          >
            Fixed
          </button>
        </div>
        {list.loading ? (
          <div className="skeleton h-28 w-full" />
        ) : list.error ? (
          <ErrorState
            error={plainHelpError(list.error)}
            action={
              scope === 'ALL' ? (
                <button onClick={() => setScope('NEAR_ME')}>Show issues near me</button>
              ) : (
                <button onClick={list.reload}>Try again</button>
              )
            }
          />
        ) : (list.data ?? []).length === 0 ? (
          <EmptyState title="Nothing here" text="No issues match this view." />
        ) : (
          <ul className="grid gap-2.5">
            {(list.data ?? []).map(r => (
              <IssueRowCard key={r.id} row={r} />
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

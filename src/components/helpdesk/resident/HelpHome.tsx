'use client';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Chip } from '@/components/ui/Chip';
import { buttonClasses } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import type { TabKey } from '@/types/helpdeskResident';
import { HelpTabs } from './HelpTabs';
import { IssueRowCard } from './IssueRowCard';
import { etaText, plainHelpError, statusLabel, statusTone } from './format';

/** Help tab home (spec 11.6): the two report buttons, issues near me and my complaints (Open / Closed). */
export function HelpHome() {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.view} title="Help">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canCreate = usePermission(PERMISSIONS.resident.helpdesk.create);
  const [tab, setTab] = useState<TabKey>('OPEN');
  const near = useLoad(() => svc.buildingIssues({ scope: 'NEAR_ME', limit: 5 }), 'near');
  const mine = useLoad(() => svc.myTickets({ tab, limit: 30 }), `mine-${tab}`);
  return (
    <Page>
      <PageHead title="Help" sub="Raise a complaint for your flat or report a problem in the building." />
      <HelpTabs />
      {canCreate && (
        <div className="mb-4 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
          <Link href="/resident/help/new" className={buttonClasses('primary', 'md', true)}>
            Raise a complaint
          </Link>
          <Link href="/resident/help/issue" className={buttonClasses('gold', 'md', true)}>
            Report a building issue
          </Link>
        </div>
      )}

      <Card title="Issues near me" sub="Problems in the building that affect your flat.">
        {near.loading ? (
          <div className="skeleton h-20 w-full" />
        ) : near.error ? (
          <ErrorState
            error={plainHelpError(near.error)}
            action={<button onClick={near.reload}>Try again</button>}
          />
        ) : (near.data ?? []).length === 0 ? (
          <EmptyState
            title="No open issues near you"
            text="When something is reported, you will see it here."
          />
        ) : (
          <ul className="grid gap-2.5">
            {(near.data ?? []).map(r => (
              <IssueRowCard key={r.id} row={r} />
            ))}
          </ul>
        )}
        <div className="mt-3 text-right">
          <Link href="/resident/help/issues" className="text-[13px] font-semibold underline">
            See all building issues
          </Link>
        </div>
      </Card>

      <Card title="My complaints" className="mt-4">
        <div role="tablist" aria-label="My complaints" className="mb-3 flex gap-1.5">
          {(['OPEN', 'CLOSED'] as TabKey[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                'rounded-full px-3.5 py-1.5 text-[13px] font-semibold',
                tab === t ? 'bg-navy text-[#FDF8EE]' : 'bg-white/60 hover:bg-white/90',
              )}
            >
              {t === 'OPEN' ? 'Open' : 'Closed'}
            </button>
          ))}
        </div>
        {mine.loading ? (
          <div className="skeleton h-24 w-full" />
        ) : mine.error ? (
          <ErrorState
            error={plainHelpError(mine.error)}
            action={<button onClick={mine.reload}>Try again</button>}
          />
        ) : (mine.data?.items ?? []).length === 0 ? (
          <EmptyState
            title={tab === 'OPEN' ? 'No open complaints' : 'Nothing closed yet'}
            text={tab === 'OPEN' ? 'Raise a complaint if something needs fixing in your flat.' : undefined}
          />
        ) : (
          <ul className="grid gap-2.5">
            {(mine.data?.items ?? []).map(t => (
              <li key={t.id} className="rounded-[14px] bg-white/60 p-3">
                <Link href={`/resident/help/${t.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-[15px] font-semibold">{t.title}</span>
                    <Chip tone={statusTone(t.status)}>{statusLabel(t.status)}</Chip>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {[t.ticketNo, t.kind === 'BUILDING' ? 'Building issue' : t.unitLabel, etaText(t)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

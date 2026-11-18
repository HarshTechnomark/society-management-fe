'use client';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { PERMISSIONS } from '@/constants/permissions';
import { Alert } from '@/components/ui/Alert';
import { useFeatureState } from '@/lib/entitlements';
import { useMe } from '@/lib/auth';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import { HelpTabs } from './HelpTabs';
import { plainHelpError } from './format';

const monthName = (ym: string) => {
  const d = new Date(`${ym}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? ym : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
export const hoursText = (h: number | null) =>
  h == null ? '-' : h < 48 ? `${Math.round(h * 10) / 10} hours` : `${Math.round(h / 24)} days`;

/** How the society handles building issues, month by month (spec 8.28). No names, no personal complaints. */
export function TransparencyScreen() {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.view} title="Help">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const on = useFeatureState('helpdesk.committee_transparency_board');
  const { ready } = useMe();
  if (!ready) return null;
  if (!on)
    return (
      <Page>
        <PageHead title="How we are doing" />
        <HelpTabs />
        <Alert tone="info">This page is not part of your society’s plan.</Alert>
      </Page>
    );
  return <Board />;
}

function Board() {
  const t = useLoad(() => svc.transparency(6), 'transparency');
  return (
    <Page>
      <PageHead title="How we are doing" sub="Building issues raised and fixed in the last 6 months." />
      <HelpTabs />
      <Card>
        {t.loading ? (
          <div className="skeleton h-32 w-full" />
        ) : t.error ? (
          <ErrorState
            error={plainHelpError(t.error)}
            action={<button onClick={t.reload}>Try again</button>}
          />
        ) : (t.data ?? []).length === 0 ? (
          <EmptyState title="No data yet" text="Numbers appear after building issues are reported." />
        ) : (
          <ul className="grid gap-2.5">
            {(t.data ?? []).map(m => (
              <li key={m.month} className="rounded-[14px] bg-white/60 p-3">
                <div className="text-[15px] font-bold">{monthName(m.month)}</div>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[13.5px]">
                  <dt className="text-muted">Reported</dt>
                  <dd className="font-semibold">{m.buildingIssuesRaised}</dd>
                  <dt className="text-muted">Fixed</dt>
                  <dd className="font-semibold">{m.resolved}</dd>
                  <dt className="text-muted">Usual time to fix</dt>
                  <dd className="font-semibold">{hoursText(m.medianResolutionHours)}</dd>
                  <dt className="text-muted">Fixed on time</dt>
                  <dd className="font-semibold">
                    {m.resolutionMetPct == null ? '-' : `${m.resolutionMetPct}%`}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}

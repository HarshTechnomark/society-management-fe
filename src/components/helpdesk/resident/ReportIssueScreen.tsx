'use client';
import { useRouter } from 'next/navigation';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import { ApiError } from '@/lib/apiClient';
import { BuildingIssueForm } from './BuildingIssueForm';
import { HelpTabs } from './HelpTabs';
import { plainHelpError } from './format';

/** Report a building issue: building, floor, spot, category, urgency, photo (spec 11.6, 8.10). */
export function ReportIssueScreen() {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.create} title="Help">
      <Page>
        <PageHead
          title="Report a building issue"
          sub="Lifts, water, lights, security and other shared places."
        />
        <HelpTabs />
        <Card>
          <ResidentForm />
        </Card>
      </Page>
    </Gate>
  );
}

function ResidentForm() {
  const router = useRouter();
  return <BuildingIssueForm audience="me" onReported={r => router.push(`/resident/help/${r.id}`)} />;
}

/** QR landing (spec 11.6): the form opens with the place filled in; with no QR in the plan the normal form shows. */
export function QrLandingScreen({ qrToken }: { qrToken: string }) {
  return (
    <Gate view={PERMISSIONS.resident.helpdesk.create} title="Help">
      <Page>
        <PageHead title="Report a building issue" sub="You scanned a QR code in the building." />
        <HelpTabs />
        <QrInner qrToken={qrToken} />
      </Page>
    </Gate>
  );
}

function QrInner({ qrToken }: { qrToken: string }) {
  const router = useRouter();
  const qr = useLoad(() => svc.qr(qrToken), `qr-${qrToken}`);
  const noPlan = qr.error instanceof ApiError && qr.error.code === 'FEATURE_NOT_IN_PLAN';
  if (qr.loading)
    return (
      <Card>
        <div className="skeleton h-40 w-full" />
      </Card>
    );
  if (qr.error && !noPlan)
    return (
      <Card>
        <ErrorState
          error={plainHelpError(qr.error)}
          notFoundAction={
            <p className="text-[13px] text-muted">
              Use “Report a building issue” and choose the place yourself.
            </p>
          }
          action={<button onClick={qr.reload}>Try again</button>}
        />
      </Card>
    );
  return (
    <Card>
      {noPlan && <Alert tone="info">QR reporting is not part of your plan. Choose the place yourself.</Alert>}
      <BuildingIssueForm
        audience="me"
        qr={qr.data}
        qrToken={qr.data ? qrToken : undefined}
        onReported={r => router.push(`/resident/help/${r.id}`)}
      />
    </Card>
  );
}

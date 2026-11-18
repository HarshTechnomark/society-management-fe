import { notFound } from 'next/navigation';
import { QrLandingScreen } from '@/components/helpdesk/resident/ReportIssueScreen';

export const metadata = { title: 'Report a building issue' };

export default async function Page({ params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;
  if (!/^[A-Za-z0-9]{12}$/.test(qrToken)) notFound();
  return <QrLandingScreen qrToken={qrToken} />;
}

import { notFound } from 'next/navigation';
import { TicketDetailScreen } from '@/components/helpdesk/resident/TicketDetailScreen';

export const metadata = { title: 'Complaint' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <TicketDetailScreen id={Number(id)} />;
}

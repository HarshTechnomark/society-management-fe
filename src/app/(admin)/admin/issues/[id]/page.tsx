import { TicketPage } from '@/components/helpdesk/admin/TicketPage';

export const metadata = { title: 'Issue' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketPage id={Number(id)} />;
}

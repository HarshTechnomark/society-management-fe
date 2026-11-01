import { notFound } from 'next/navigation';
import { ConsentApproval } from '@/components/societies/admin/ConsentApproval';

export const metadata = { title: 'Support access request' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ConsentApproval id={id} />;
}

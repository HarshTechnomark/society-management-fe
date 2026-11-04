import { notFound } from 'next/navigation';
import { ResidentBillDetail } from '@/components/maintenance/dues/ResidentBillDetail';

export const metadata = { title: 'Bill' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <ResidentBillDetail id={Number(id)} />;
}

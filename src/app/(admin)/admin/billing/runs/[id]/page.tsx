import { notFound } from 'next/navigation';
import { RunDetailScreen } from '@/components/maintenance/runs/RunDetailScreen';

export const metadata = { title: 'Billing run' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <RunDetailScreen id={Number(id)} />;
}

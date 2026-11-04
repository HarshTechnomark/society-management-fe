import { notFound } from 'next/navigation';
import { ResidentStatement } from '@/components/maintenance/dues/ResidentStatement';

export const metadata = { title: 'Statement' };

export default async function Page({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  if (!/^\d+$/.test(unitId)) notFound();
  return <ResidentStatement unitId={Number(unitId)} />;
}

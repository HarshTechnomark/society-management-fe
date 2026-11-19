import { notFound } from 'next/navigation';
import { NoticeDetailScreen } from '@/components/communication/resident/NoticeDetailScreen';

export const metadata = { title: 'Notice' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <NoticeDetailScreen id={Number(id)} />;
}

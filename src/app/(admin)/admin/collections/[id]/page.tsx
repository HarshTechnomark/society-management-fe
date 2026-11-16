import { notFound } from 'next/navigation';
import { CollectionDetailScreen } from '@/components/payments/collections/CollectionDetailScreen';

export const metadata = { title: 'Collection' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <CollectionDetailScreen id={Number(id)} />;
}

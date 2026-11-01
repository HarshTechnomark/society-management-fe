import { notFound } from 'next/navigation';
import { SocietyDetailScreen } from '@/components/societies/platform/SocietyDetailScreen';

export const metadata = { title: 'Society' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <SocietyDetailScreen id={id} />;
}

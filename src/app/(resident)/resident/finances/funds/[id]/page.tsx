import { notFound } from 'next/navigation';
import { FundStatementScreen } from '@/components/accounts/resident/FundStatementScreen';

export const metadata = { title: 'Fund statement' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return <FundStatementScreen id={Number(id)} />;
}

import { notFound } from 'next/navigation';
import { PayStatusScreen } from '@/components/payments/resident/PayStatusScreen';

export const metadata = { title: 'Payment status' };

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!/^\d+$/.test(orderId)) notFound();
  return <PayStatusScreen orderId={Number(orderId)} />;
}

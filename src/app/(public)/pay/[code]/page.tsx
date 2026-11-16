import type { Metadata } from 'next';
import { PublicPayLink } from '@/components/payments/public/PublicPayLink';

export const metadata: Metadata = {
  title: 'Pay securely',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <PublicPayLink code={(await params).code} />;
}

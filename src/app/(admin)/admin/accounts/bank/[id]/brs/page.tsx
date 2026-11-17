import { BrsScreen } from '@/components/accounts/brs/BrsScreen';

export const metadata = { title: 'Bank reconciliation statement' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BrsScreen bankAccountId={Number((await params).id) || 0} />;
}

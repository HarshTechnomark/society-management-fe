import { ReconciliationScreen } from '@/components/accounts/statements/ReconciliationScreen';

export const metadata = { title: 'Bank reconciliation' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ReconciliationScreen id={Number((await params).id) || 0} />;
}

import { notFound } from 'next/navigation';
import { HouseholdPermissions } from '@/components/access/household/HouseholdPermissions';

export const metadata = { title: 'Household permissions' };

export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const id = Number((await params).memberId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <HouseholdPermissions memberId={id} />;
}

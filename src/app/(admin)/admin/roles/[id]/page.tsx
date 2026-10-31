import { notFound } from 'next/navigation';
import { RoleEditor } from '@/components/access/roles/RoleEditor';

export const metadata = { title: 'Role' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <RoleEditor roleId={id} />;
}

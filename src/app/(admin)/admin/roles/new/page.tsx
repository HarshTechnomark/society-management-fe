import { RoleEditor } from '@/components/access/roles/RoleEditor';

export const metadata = { title: 'New role' };

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const id = Number(from);
  return <RoleEditor cloneFrom={Number.isInteger(id) && id > 0 ? id : undefined} />;
}

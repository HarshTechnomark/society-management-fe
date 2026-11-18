import { ApprovalPage } from '@/components/approvals/detail/ApprovalPage';

export const metadata = { title: 'Approval' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApprovalPage id={Number(id)} />;
}

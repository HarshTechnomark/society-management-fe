import { notFound } from 'next/navigation';
import { Page as Shell, PageHead } from '@/components/common/PageHead';
import { SocietyPlanTab } from '@/components/subscription/platform/SocietyPlanTab';

export const metadata = { title: 'Society plan' };

/** Minimal route for the Plan tab until module 05 builds the society detail page and mounts the tab there. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Shell>
      <PageHead title="Society plan" sub={`Society ${id}`} />
      <SocietyPlanTab societyId={id} />
    </Shell>
  );
}

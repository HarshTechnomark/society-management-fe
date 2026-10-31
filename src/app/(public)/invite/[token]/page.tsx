import type { Metadata } from 'next';
import { InviteScreen } from '@/components/access/invite/InviteScreen';

export const metadata: Metadata = { title: 'Invitation' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <InviteScreen token={(await params).token} />;
}

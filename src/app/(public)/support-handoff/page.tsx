import type { Metadata } from 'next';
import { SupportHandoffScreen } from '@/components/societies/public/SupportHandoffScreen';

export const metadata: Metadata = { title: 'Opening the society' };

export default function Page() {
  return <SupportHandoffScreen />;
}

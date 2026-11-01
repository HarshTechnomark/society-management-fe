import type { Metadata } from 'next';
import { SubscriptionScreen } from '@/components/subscription/society/SubscriptionScreen';

export const metadata: Metadata = { title: 'Subscription' };

export default function Page() {
  return <SubscriptionScreen />;
}

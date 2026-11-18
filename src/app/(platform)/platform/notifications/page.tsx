import { InboxScreen } from '@/components/communication/resident/InboxScreen';

export const metadata = { title: 'Notifications' };

export default function Page() {
  return <InboxScreen scope="platform" />;
}

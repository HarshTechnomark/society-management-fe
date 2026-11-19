import { NotificationsScreen } from '@/components/notifications/NotificationsScreen';

export const metadata = { title: 'Inbox' };

export default function Page() {
  return <NotificationsScreen app="RESIDENT" />;
}

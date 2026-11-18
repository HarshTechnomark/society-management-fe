import { FieldIssueScreen } from '@/components/helpdesk/field/FieldIssueScreen';

export const metadata = { title: 'Report a building issue' };

export default function Page() {
  return <FieldIssueScreen audience="work" />;
}

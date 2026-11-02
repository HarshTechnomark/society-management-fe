import { AuditScreen } from '@/components/platformOps/audit/AuditScreen';

export const metadata = { title: 'Audit trail' };

export default function Page() {
  return <AuditScreen scope="society" />;
}

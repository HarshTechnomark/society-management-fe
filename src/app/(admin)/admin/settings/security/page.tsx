import type { Metadata } from 'next';
import { SecurityCenter } from '@/components/auth/SecurityCenter';

export const metadata: Metadata = { title: 'My security' };

export default function Page() {
  return (
    <main id="main" className="p-4 min-[1001px]:p-8">
      <SecurityCenter />
    </main>
  );
}

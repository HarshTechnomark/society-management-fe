import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/common/Providers';

export const metadata: Metadata = {
  title: { default: 'SocietyApp', template: '%s · SocietyApp' },
  description: 'Run your housing society from one app.',
  robots: { index: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#143041' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

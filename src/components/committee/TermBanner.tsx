'use client';
import { Alert } from '@/components/ui/Alert';
import { shortDate } from '@/lib/money';
import type { Banner } from '@/types/committee';
import { bannerText } from './format';

/** The term banner of `GET /committee` on the Team screen (spec 11.1), with a link to the Committee tab. */
export function TermBanner({ banner, onOpen }: { banner: Banner | null; onOpen: () => void }) {
  if (!banner) return null;
  return (
    <Alert tone={banner.code === 'TERM_ENDING' ? 'info' : 'warn'}>
      <span data-testid="term-banner">
        {bannerText(banner, shortDate)}{' '}
        <button type="button" className="font-bold underline" onClick={onOpen}>
          Open the Committee tab
        </button>
      </span>
    </Alert>
  );
}

'use client';
import { QrCode } from '@/components/auth/QrCode';
import { buttonClasses } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import type { Checkout } from '@/types/paymentsResident';

/** "9:05" from seconds. */
export const clockText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function isPhone(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= 700;
}

/**
 * What the shape of `checkout` asks for: phone → UPI app link; desktop → QR with a countdown to `expiresAt`; a
 * hosted page (cards, net banking) → a link. The fake gateway has none of these, the test panel is used instead.
 */
export function CheckoutOptions({ checkout, expiresAt }: { checkout: Checkout; expiresAt: string | null }) {
  const left = useCountdown(expiresAt);
  const phone = isPhone();
  if (checkout.isFake) return null;
  return (
    <div className="grid gap-3">
      {phone && checkout.upiIntentUrl && (
        <a href={checkout.upiIntentUrl} className={buttonClasses('primary', 'md', true)}>
          Open your UPI app
        </a>
      )}
      {!phone && (checkout.qrPayload ?? checkout.upiIntentUrl) && (
        <div className="flex flex-col items-center gap-1">
          <QrCode
            value={(checkout.qrPayload ?? checkout.upiIntentUrl) as string}
            label="QR code to pay from your UPI app"
          />
          <p className="text-[13px] text-muted">Scan with any UPI app.</p>
        </div>
      )}
      {checkout.redirectUrl && (
        <a href={checkout.redirectUrl} className={buttonClasses('glass', 'md', true)}>
          Pay by card or net banking
        </a>
      )}
      {expiresAt && (
        <p className="text-center text-[13px] text-muted" aria-live="off">
          {left > 0 ? `This payment window closes in ${clockText(left)}.` : 'This payment window has closed.'}
        </p>
      )}
    </div>
  );
}

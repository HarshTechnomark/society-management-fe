'use client';
import { QrCode } from '@/components/auth/QrCode';
import { buttonClasses } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import type { Checkout } from '@/types/paymentsResident';

/** Time left from seconds: "9:05" under an hour, then "47 hours 59 minutes", then "6 days 23 hours". */
export function clockText(s: number): string {
  const t = Math.max(0, Math.floor(s));
  if (t < 3600) return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const hours = Math.floor(t / 3600);
  if (hours >= 48) return `${unit(Math.floor(hours / 24), 'day')} ${unit(hours % 24, 'hour')}`;
  return `${unit(hours, 'hour')} ${unit(Math.floor((t % 3600) / 60), 'minute')}`;
}

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

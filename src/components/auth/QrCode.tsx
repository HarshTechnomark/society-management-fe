'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Draws the QR for an `otpauth://` URI in the browser. The URI never leaves the page. */
export function QrCode({
  value,
  label = 'QR code for your authenticator app',
}: {
  value: string;
  label?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: 192, errorCorrectionLevel: 'M' })
      .then(url => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [value]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={192} height={192} alt={label} className="rounded-2xl bg-white p-2" />
  ) : (
    <div
      className="h-[192px] w-[192px] animate-pulse rounded-2xl bg-white/70"
      role="img"
      aria-label="Loading QR code"
    />
  );
}

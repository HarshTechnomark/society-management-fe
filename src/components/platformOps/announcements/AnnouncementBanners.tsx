'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/societies/bits';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import { usePolling } from '../usePolling';

const TONE = { INFO: 'info', WARNING: 'warn', CRITICAL: 'bad' } as const;

/**
 * Platform announcements at the top of every admin page, below the society status banner (spec 11.5). Critical
 * ones cannot be dismissed. Failures stay silent: a banner must never block the page.
 */
export function AnnouncementBanners({ enabled = true }: { enabled?: boolean }) {
  const { data, reload } = usePolling(() => svc.myBanners().catch(() => []), 60_000, enabled);
  const [hidden, setHidden] = useState<number[]>([]);
  const list = (data ?? []).filter(b => !hidden.includes(b.id));
  if (list.length === 0) return null;
  return (
    <div
      className="mx-auto w-full max-w-[1100px] px-4 pt-4 sm:px-6"
      aria-label="Announcements from SocietyApp"
    >
      {list.map(b => (
        <Banner
          key={b.id}
          tone={TONE[b.severity] ?? 'info'}
          action={
            <span className="flex flex-wrap gap-2">
              {b.ctaUrl && b.ctaLabel && (
                <a
                  href={b.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-[30px] items-center rounded-full border border-white/80 bg-white/60 px-3 text-[12.5px] font-semibold text-ink hover:bg-white/80"
                >
                  {b.ctaLabel}
                </a>
              )}
              {b.isDismissible && b.severity !== 'CRITICAL' && (
                <Button
                  size="xs"
                  variant="glass"
                  onClick={async () => {
                    setHidden(h => [...h, b.id]);
                    try {
                      await svc.dismissBanner(b.id);
                    } catch {
                      void reload();
                    }
                  }}
                >
                  Dismiss
                </Button>
              )}
            </span>
          }
        >
          <b>{b.title}</b> {b.body}
        </Banner>
      ))}
    </div>
  );
}

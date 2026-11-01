'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useCountdown } from '@/hooks/useCountdown';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { societiesService } from '@/services/societies.service';
import type { SupportGrant } from '@/types/societies';
import { emitGrantChanged, onGrantChanged } from '../events';
import { clockTime, mmss, societyErrorText } from '../format';

interface Open {
  grant: SupportGrant;
  /** Epoch ms when access ends, from `secondsLeft` when the API sent it (server clock), else `endsAt`. */
  endsAt: number;
}

/**
 * P-07 global support banner on every platform screen while my grant is ACTIVE: society, scope, end time and a
 * countdown, with End now. At zero it asks the API again and says the access expired.
 */
export function PlatformSupportBanner() {
  useMe();
  const toast = useToast();
  const canHold = usePermission(PERMISSIONS.platform.supportAccess.create);
  const [open, setOpen] = useState<Open | null>(null);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(open?.endsAt ?? null);
  const checkedAtZero = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { grant, secondsLeft } = await societiesService.currentGrant();
      if (grant && grant.status === 'ACTIVE') {
        const endsAt =
          secondsLeft !== null && secondsLeft !== undefined
            ? Date.now() + secondsLeft * 1000
            : grant.endsAt
              ? Date.parse(grant.endsAt)
              : Date.now();
        setOpen({ grant, endsAt });
        return grant;
      }
      setOpen(null);
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!canHold) return;
    // First load on the next tick, so the effect itself never sets state.
    const first = setTimeout(() => void load(), 0);
    const off = onGrantChanged(() => void load());
    const id = setInterval(() => void load(), 60_000);
    return () => {
      clearTimeout(first);
      off();
      clearInterval(id);
    };
  }, [canHold, load]);

  // At zero: ask once whether the grant is still active; if not, say it expired.
  useEffect(() => {
    if (!open || left > 0 || checkedAtZero.current === open.grant.id) return;
    checkedAtZero.current = open.grant.id;
    const name = open.grant.society.name;
    void load().then(g => {
      if (!g) toast.show(`Support access to ${name} expired`, 'warning');
    });
  }, [open, left, load, toast]);

  if (!open || !canHold) return null;
  const g = open.grant;

  const end = async () => {
    setBusy(true);
    try {
      await societiesService.endGrant(g.id);
      setOpen(null);
      toast.show('Support access ended');
      emitGrantChanged();
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex flex-wrap items-center justify-center gap-3 bg-bad px-4 py-2 text-[13.5px] font-semibold text-white"
    >
      <span>
        Support access active · {g.society.name} · {g.scope === 'READ_ONLY' ? 'read only' : 'read and write'}{' '}
        · expires {clockTime(new Date(open.endsAt).toISOString())} (
        <span className="tabular-nums">{mmss(left)}</span> left)
      </span>
      <Button size="xs" variant="glass" loading={busy} onClick={end}>
        End now
      </Button>
    </div>
  );
}

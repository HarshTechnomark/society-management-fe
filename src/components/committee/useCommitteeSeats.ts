'use client';
import { useMemo } from 'react';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { committeeService } from '@/services/committee.service';
import type { Banner, Seat } from '@/types/committee';

/** Role keys the committee seats map to (BR-10-6): a member with one of them should hold a seat. */
export const COMMITTEE_ROLE_KEYS = ['chairman', 'secretary', 'treasurer', 'committee_member'];

/**
 * What the Team screen (spec 11.1) shows from module 10: the term banner (`GET /committee` `banner`) and the seat of each
 * member (seats of the current term). Nothing is loaded without `settings.members.view` and the committee terms plan feature;
 * a failed load just hides the extras.
 */
export function useCommitteeSeats() {
  const canView = usePermission(PERMISSIONS.settings.members.view);
  const inPlan = useFeature('governance.committee_terms');
  const on = canView && inPlan;
  const overview = useLoad(() => (on ? committeeService.overview() : Promise.resolve(null)), on);
  const currentId = overview.data?.current?.id ?? null;
  const term = useLoad(
    () => (on && currentId ? committeeService.term(currentId) : Promise.resolve(null)),
    `${on}-${currentId}-${overview.data?.current?.version ?? 0}`,
  );
  const seatByUser = useMemo(() => {
    const m = new Map<number, Seat>();
    for (const s of term.data?.seats ?? [])
      if (s.status === 'SEATED' && s.userId !== null) m.set(s.userId, s);
    return m;
  }, [term.data]);
  const banner: Banner | null =
    overview.data?.banner && overview.data.banner.code !== 'NO_COMMITTEE' ? overview.data.banner : null;
  return { enabled: on, banner, seatByUser, loading: overview.loading || term.loading };
}

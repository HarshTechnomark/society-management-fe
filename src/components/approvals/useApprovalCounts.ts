'use client';
import { useEffect, useState } from 'react';
import { approvalsService } from '@/services/approvals.service';
import type { ApprovalCounts } from '@/types/approvals';

/**
 * `GET /approvals/counts` for the menu badge and the home card. Loads only when `enabled` (the person has the inbox permission),
 * again whenever `refreshKey` changes, and stays null on any error: a badge never blocks a page.
 */
export function useApprovalCounts(enabled: boolean, refreshKey = ''): ApprovalCounts | null {
  const [counts, setCounts] = useState<ApprovalCounts | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    approvalsService
      .counts()
      .then(c => live && setCounts(c))
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
  }, [enabled, refreshKey]);
  return enabled ? counts : null;
}

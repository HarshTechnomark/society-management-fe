'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { helpdeskResidentService as svc } from '@/services/helpdeskResident.service';
import type { BuildingIssueRow } from '@/types/helpdeskResident';
import { PRIORITY_LABEL, etaText, helpError, isTerminal, statusLabel, statusTone } from './format';

/** One building issue with its "Me too" button (spec 11.6). */
export function IssueRowCard({ row }: { row: BuildingIssueRow }) {
  const toast = useToast();
  const [r, setR] = useState(row);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      const u = r.iUpvoted ? await svc.removeUpvote(r.id) : await svc.upvote(r.id);
      setR({ ...r, iUpvoted: u.iUpvoted, upvoteCount: u.upvoteCount });
    } catch (e) {
      toast.show(helpError(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const eta = etaText({ status: r.status, waitingReason: null, resolutionDueAt: r.resolutionDueAt });
  return (
    <li className="glass p-3.5">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/resident/help/${r.id}`} className="min-w-0 font-semibold hover:underline">
          <span className="block truncate text-[15px]">{r.title}</span>
        </Link>
        <Chip tone={statusTone(r.status)}>{statusLabel(r.status)}</Chip>
      </div>
      <div className="mt-0.5 text-[12.5px] text-muted">
        {[r.locationLabel, r.ticketNo, PRIORITY_LABEL[r.priority]].filter(Boolean).join(' · ')}
      </div>
      {eta && <div className="mt-0.5 text-[12.5px] text-muted">{eta}</div>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">
          {r.upvoteCount} Me too{r.affectedUnitCount > 0 ? ` · ${r.affectedUnitCount} flats affected` : ''}
        </span>
        {!r.isRequester && !isTerminal(r.status) && (
          <Button
            size="sm"
            variant={r.iUpvoted ? 'glass' : 'gold'}
            loading={busy}
            onClick={() => void toggle()}
          >
            {r.iUpvoted ? 'Undo Me too' : 'Me too'}
          </Button>
        )}
      </div>
    </li>
  );
}

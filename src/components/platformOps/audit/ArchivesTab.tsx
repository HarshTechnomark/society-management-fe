'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Card } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import { opsError } from '../format';

/** Spec 11.7 Archives tab: Month, Part, Rows, Status, Archived on, Download (step-up on the API). */
export function ArchivesTab() {
  const toast = useToast();
  const canDownload = usePermission(PERMISSIONS.platform.auditLog.export);
  const load = useLoad(() => svc.auditArchives(), 'archives');
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (month: string, part: number) => {
    setBusy(`${month}-${part}`);
    try {
      const r = await svc.archiveDownloadUrl(month, part);
      window.location.assign(r.url);
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  const d = load.data;
  return (
    <Card
      title="Archives"
      sub={
        d
          ? `Entries older than ${d.archiveAfterMonths} months move here${d.paused ? ' (archiving is paused)' : ''}.`
          : undefined
      }
    >
      {load.error ? (
        <ErrorState error={load.error} />
      ) : load.loading ? (
        <div className="skeleton h-24 w-full" />
      ) : !d || d.items.length === 0 ? (
        <EmptyState title="Nothing archived yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <caption className="sr-only">Audit archives</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                {['Month', 'Part', 'Rows', 'Status', 'Archived on', ''].map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2.5">
                    {h || <span className="sr-only">Download</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.items.map(a => (
                <tr key={`${a.month}-${a.part}`} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-3">{a.month}</td>
                  <td className="px-3 py-3">{a.part}</td>
                  <td className="px-3 py-3 tabular-nums">{a.rowCount.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-3">{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</td>
                  <td className="px-3 py-3">{shortDate(a.archivedAt)}</td>
                  <td className="px-3 py-3 text-right">
                    {canDownload && a.status === 'COMPLETED' && (
                      <Button
                        size="xs"
                        variant="glass"
                        loading={busy === `${a.month}-${a.part}`}
                        onClick={() => download(a.month, a.part)}
                      >
                        Download
                        <span className="sr-only">
                          {' '}
                          {a.month} part {a.part}
                        </span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { shortDate } from '@/lib/money';
import { societiesService } from '@/services/societies.service';
import type { DataExport } from '@/types/societies';
import { bytes, dateTime, societyErrorText } from '../format';

const STATUS: Record<DataExport['status'], [string, 'info' | 'ok' | 'bad' | 'neutral']> = {
  QUEUED: ['Queued', 'info'],
  RUNNING: ['Preparing', 'info'],
  READY: ['Ready', 'ok'],
  FAILED: ['Failed', 'bad'],
  EXPIRED: ['Expired', 'neutral'],
};

/** A-06 Settings › Data export: request a full export (step-up) and download ready parts (step-up, 5-minute links). */
export function DataExportSettings() {
  const { ready } = useMe();
  const toast = useToast();
  const canView = usePermission(PERMISSIONS.settings.dataExport.view);
  const canCreate = usePermission(PERMISSIONS.settings.dataExport.create);
  const list = useLoad(() => (canView ? societiesService.exports() : Promise.resolve(null)), canView);
  const [asking, setAsking] = useState(false);
  const [docs, setDocs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const rows = list.data?.data ?? [];
  const running = rows.some(r => r.status === 'QUEUED' || r.status === 'RUNNING');
  const { reload } = list;

  // Progress: poll while an export is being prepared (the realtime `data_export.progress` event can replace this).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(reload, 5000);
    return () => clearInterval(id);
  }, [running, reload]);

  const request = async () => {
    setBusy(true);
    try {
      await societiesService.requestExport(docs);
      toast.show('Export requested. You are notified when it is ready.');
      setAsking(false);
      reload();
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const download = async (x: DataExport, part: number) => {
    setDownloading(`${x.id}:${part}`);
    try {
      const u = await societiesService.downloadUrl(x.id, part);
      window.location.assign(u.url);
    } catch (e) {
      toast.show(societyErrorText(e), 'error');
      reload();
    } finally {
      setDownloading(null);
    }
  };

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Data export" />
        <Card>
          <EmptyState
            title="No access"
            text="Ask your chairman or secretary for a copy of your society's data."
          />
        </Card>
      </Page>
    );

  return (
    <Page>
      <PageHead
        title="Data export"
        sub="Everything your society has in SocietyApp, as a zip of CSV files and documents. Download links work for 7 days."
        actions={
          canCreate && (
            <Button size="sm" disabled={running} onClick={() => setAsking(true)}>
              Request export
            </Button>
          )
        }
      />
      <Card>
        {list.error ? (
          <ErrorState error={list.error} />
        ) : list.loading && !list.data ? (
          <div className="skeleton h-24 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No exports yet"
            text="You have not exported data yet. Your data belongs to your society; export it any time."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <caption className="sr-only">Data exports</caption>
              <thead>
                <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Parts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(x => (
                  <tr key={x.id} className="border-b border-[var(--line)] align-top last:border-0">
                    <td className="px-3 py-2.5">
                      <b>{x.kind === 'CLOSURE' ? 'Closure export' : 'Full export'}</b>
                      <div className="text-[12.5px] text-muted">
                        {x.requestedBy?.name ?? (x.requestedVia === 'PLATFORM' ? 'SocietyApp' : 'System')}
                        {x.createdAt ? ` · ${dateTime(x.createdAt)}` : ''}
                        {x.includeDocuments ? ' · with documents' : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Chip tone={STATUS[x.status][1]}>{STATUS[x.status][0]}</Chip>
                      {(x.status === 'QUEUED' || x.status === 'RUNNING') && (
                        <div
                          role="progressbar"
                          aria-label="Export progress"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={x.progressPercent}
                          className="mt-1.5 h-2 w-28 overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]"
                        >
                          <div
                            className="h-full rounded-full bg-navy"
                            style={{ width: `${x.progressPercent}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{bytes(x.totalSizeBytes)}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {x.status === 'READY' ? shortDate(x.expiresAt) : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      {x.status === 'READY' ? (
                        <span className="flex flex-wrap gap-1">
                          {Array.from({ length: Math.max(1, x.partCount) }, (_, i) => i + 1).map(p => (
                            <Button
                              key={p}
                              size="xs"
                              variant="glass"
                              loading={downloading === `${x.id}:${p}`}
                              onClick={() => download(x, p)}
                              aria-label={`Download part ${p} of ${x.partCount}`}
                            >
                              Download {x.partCount > 1 ? p : ''}
                            </Button>
                          ))}
                        </span>
                      ) : (
                        <span className="text-faint">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal
        open={asking}
        onClose={() => setAsking(false)}
        title="Request a full export?"
        description="We prepare a zip of CSV files (and documents if you choose). You will need to confirm it is you. At most two exports a day."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={request}>
              Request export
            </Button>
          </>
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">Include documents</p>
            <p className="text-[12.5px] text-muted">
              Bills, receipts and other files. Makes the export larger.
            </p>
          </div>
          <Switch label="Include documents" checked={docs} onChange={setDocs} />
        </div>
      </Modal>
    </Page>
  );
}

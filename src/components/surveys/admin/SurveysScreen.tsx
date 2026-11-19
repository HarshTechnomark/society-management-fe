'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Page, PageHead } from '@/components/common/PageHead';
import { Segments } from '@/components/residents/common';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { surveysService } from '@/services/surveys.service';
import type { SurveyListItem } from '@/types/surveys';
import { STATUS_LABEL, dateTime, isStale, noticeError, pct, plainError, statusTone } from './format';
import { SurveyEditor } from './SurveyEditor';
import { SurveyResultsDrawer } from './SurveyResultsDrawer';

type Seg = 'ALL' | 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
const SEGMENTS: { key: Seg; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'OPEN', label: 'Open' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

/** Admin surveys (spec 11.5): list with a responses meter, editor and results. */
export function SurveysScreen() {
  const S = PERMISSIONS.communication.surveys;
  const canCreate = usePermission(S.create);
  const canEdit = usePermission(S.edit);
  const canExport = usePermission(S.export);
  const toast = useToast();
  const [seg, setSeg] = useState<Seg>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<{ id?: number } | null>(null);
  const [results, setResults] = useState<SurveyListItem | null>(null);
  const deep = Number(useSearchParams()?.get('open'));
  const [deepId, setDeepId] = useState<number | null>(Number.isInteger(deep) && deep > 0 ? deep : null); // `?open=<id>`
  useEffect(() => {
    if (Number.isInteger(deep) && deep > 0) setDeepId(deep); // the bell can change the query on this same page
  }, [deep]);
  const [cancelling, setCancelling] = useState<SurveyListItem | null>(null);
  const [deleting, setDeleting] = useState<SurveyListItem | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const query = { status: seg === 'ALL' ? undefined : seg, q: q.trim() || undefined, page, limit: 20 };
  const load = useLoad(() => surveysService.list(query), JSON.stringify(query) + tick);
  const refresh = () => setTick(t => t + 1);
  const items = load.data?.items ?? [];

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.show(done);
      setCancelling(null);
      setReason('');
      refresh();
    } catch (e) {
      toast.show(noticeError(e, 'survey'), 'error');
      if (isStale(e)) refresh(); // the latest is shown now
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <PageHead
        title="Surveys"
        sub="Ask residents and see the answers as charts."
        actions={canCreate && <Button onClick={() => setEditing({})}>New survey</Button>}
      />
      <div className="glass p-4 sm:p-5">
        <Input
          label="Search"
          type="search"
          value={q}
          onChange={e => {
            setQ(e.target.value);
            setPage(1);
          }}
          autoComplete="off"
        />
        <div className="mt-3">
          <Segments
            label="Survey views"
            options={SEGMENTS}
            value={seg}
            onChange={k => {
              setSeg(k);
              setPage(1);
            }}
          />
        </div>
        {load.error != null ? (
          <ErrorState
            error={plainError(load.error)}
            action={
              <Button size="sm" onClick={load.reload}>
                Try again
              </Button>
            }
          />
        ) : load.loading ? (
          <div aria-busy="true" aria-label="Loading">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton mb-2 h-16 w-full" data-testid="skeleton-row" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No surveys" text="Ask residents a few questions and see the answers here." />
        ) : (
          <ul className="grid gap-2" aria-label="Surveys">
            {items.map(s => {
              const p = pct(s.responseCount, s.recipientCount);
              return (
                <li key={s.id} className="rounded-2xl bg-white/50 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={statusTone(s.status)}>{STATUS_LABEL[s.status]}</Chip>
                    {s.isAnonymous && <Chip>Anonymous</Chip>}
                    <span className="text-[15px] font-bold">{s.title}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {s.questionCount === 1 ? '1 question' : `${s.questionCount} questions`}
                    {s.closesAt && ` · closes ${dateTime(s.closesAt)}`}
                  </p>
                  {s.status !== 'DRAFT' && (
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between text-[12.5px] text-muted">
                        <span>
                          {s.responseCount} of {s.recipientCount} responded
                        </span>
                        <span>{p}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`Responses to ${s.title}`}
                        aria-valuenow={p}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-1.5 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
                      >
                        <div className="h-full bg-navy" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.status !== 'DRAFT' && (
                      <Button size="xs" variant="glass" onClick={() => setResults(s)}>
                        Results
                      </Button>
                    )}
                    {s.status === 'DRAFT' && (canCreate || canEdit) && (
                      <Button size="xs" variant="glass" onClick={() => setEditing({ id: s.id })}>
                        Edit
                      </Button>
                    )}
                    {s.status === 'OPEN' && canEdit && (
                      <>
                        <Button
                          size="xs"
                          variant="glass"
                          loading={busy === `close${s.id}`}
                          onClick={() =>
                            void act(
                              `close${s.id}`,
                              () => surveysService.close(s.id, s.version),
                              'Survey closed',
                            )
                          }
                        >
                          Close now
                        </Button>
                        <Button size="xs" variant="danger-soft" onClick={() => setCancelling(s)}>
                          Cancel
                        </Button>
                      </>
                    )}
                    {s.status === 'DRAFT' && canEdit && (
                      <Button
                        size="xs"
                        variant="danger-soft"
                        loading={busy === `del${s.id}`}
                        onClick={() => setDeleting(s)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {(load.data?.totalPages ?? 1) > 1 && (
          <nav aria-label="Pages of surveys" className="mt-3 flex items-center justify-between gap-2">
            <Button size="sm" variant="glass" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <span className="text-[13px] text-muted">
              Page {page} of {load.data?.totalPages}
            </span>
            <Button
              size="sm"
              variant="glass"
              disabled={page >= (load.data?.totalPages ?? 1)}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </div>
      {editing && (
        <SurveyEditor
          surveyId={editing.id}
          canPublish={canCreate}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
      {!results && deepId != null && (
        <SurveyResultsDrawer
          id={deepId}
          title="Survey"
          canExport={canExport}
          onClose={() => setDeepId(null)}
        />
      )}
      {results && (
        <SurveyResultsDrawer
          id={results.id}
          title={results.title}
          canExport={canExport}
          onClose={() => setResults(null)}
        />
      )}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this draft?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={deleting ? busy === `del${deleting.id}` : false}
              onClick={() =>
                deleting &&
                void act(
                  `del${deleting.id}`,
                  () => surveysService.remove(deleting.id, deleting.version),
                  'Draft deleted',
                ).then(() => setDeleting(null))
              }
            >
              Delete draft
            </Button>
          </>
        }
      >
        <p className="text-[14px]">
          “{deleting?.title}” will be removed for good. Published surveys are not affected.
        </p>
      </Modal>
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancel this survey"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Keep it open
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 10}
              loading={busy === 'cancelGo'}
              onClick={() =>
                cancelling &&
                void act(
                  'cancelGo',
                  () =>
                    surveysService.cancel(cancelling.id, {
                      version: cancelling.version,
                      reason: reason.trim(),
                    }),
                  'Survey cancelled',
                )
              }
            >
              Cancel survey
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason (10+ characters)"
          value={reason}
          maxLength={300}
          onChange={e => setReason(e.target.value)}
        />
      </Modal>
    </Page>
  );
}

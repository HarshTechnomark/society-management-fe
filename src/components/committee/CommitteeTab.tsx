'use client';
import { useState } from 'react';
import { Card } from '@/components/common/PageHead';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { committeeService } from '@/services/committee.service';
import { Empty, Loading, Section } from '@/components/residents/common';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import type { CommitteeOverview, CurrentSummary, DraftSummary, Term } from '@/types/committee';
import { CommitteeHistory } from './CommitteeHistory';
import { EditCurrentDialog } from './EditCurrentDialog';
import { SeatCard } from './SeatCard';
import { TermEditor } from './TermEditor';
import {
  DESIGNATION_ORDER,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  bannerText,
  committeeError,
  designationLabel,
} from './format';
import type { EditorMode } from './termForm';

const M = PERMISSIONS.settings.members;
const COMING = 'Coming in the next update';

type View = { k: 'main' } | { k: 'editor'; mode: EditorMode; termId?: number } | { k: 'history' };

/** Team › Committee tab (spec 11.2): current term, seats, draft, past committees. */
export function CommitteeTab() {
  return (
    <FeatureGate feature="governance.committee_terms" title="Committee terms">
      <Inner />
    </FeatureGate>
  );
}

function Inner() {
  const [view, setView] = useState<View>({ k: 'main' });
  const [tick, setTick] = useState(0);
  const back = () => setView({ k: 'main' });
  const saved = () => {
    setTick(t => t + 1);
    back();
  };
  if (view.k === 'editor')
    return (
      <TermEditor
        key={`${view.mode}-${view.termId ?? 'new'}`}
        mode={view.mode}
        termId={view.termId}
        onClose={back}
        onSaved={saved}
        onOpenDraft={id => setView({ k: 'editor', mode: 'edit', termId: id })}
      />
    );
  if (view.k === 'history') return <CommitteeHistory onBack={back} />;
  return <Overview tick={tick} setView={setView} onChanged={() => setTick(t => t + 1)} />;
}

function Overview({
  tick,
  setView,
  onChanged,
}: {
  tick: number;
  setView: (v: View) => void;
  onChanged: () => void;
}) {
  const canCreate = usePermission(M.create);
  const load = useLoad(() => committeeService.overview(), tick);
  return (
    <Loading load={load} rows={4}>
      {o => <Loaded o={o} canCreate={canCreate} setView={setView} onChanged={onChanged} />}
    </Loading>
  );
}

function Loaded({
  o,
  canCreate,
  setView,
  onChanged,
}: {
  o: CommitteeOverview;
  canCreate: boolean;
  setView: (v: View) => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(M.edit);
  const empty = !o.current && !o.draft;
  const banner = o.banner && o.banner.code !== 'NO_COMMITTEE' ? o.banner : null;
  return (
    <div>
      {banner && (
        <Alert tone={banner.code === 'TERM_ENDING' ? 'info' : 'warn'}>
          <span>
            {bannerText(banner, shortDate)}
            {banner.code === 'DRAFT_FROM_ELECTION' && canEdit && (
              <>
                {' '}
                <button
                  type="button"
                  className="font-bold underline"
                  onClick={() => setView({ k: 'editor', mode: 'edit', termId: banner.draftId })}
                >
                  Review the draft
                </button>
              </>
            )}
          </span>
        </Alert>
      )}
      <div className="mb-3 flex justify-end">
        <Button variant="glass" size="sm" onClick={() => setView({ k: 'history' })}>
          Past committees
        </Button>
      </div>
      {empty && (
        <Card>
          <Empty
            title="No committee recorded yet. Add your managing committee."
            text="Residents and the app will know the office bearers once the committee is active."
            action={
              canCreate ? (
                <span className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setView({ k: 'editor', mode: 'new' })}>Add committee</Button>
                  <Button variant="glass" onClick={() => setView({ k: 'editor', mode: 'past' })}>
                    Record a past committee
                  </Button>
                </span>
              ) : undefined
            }
          />
        </Card>
      )}
      {o.current && <CurrentCard current={o.current} canEdit={canEdit} onChanged={onChanged} />}
      {o.draft && (
        <DraftCard
          draft={o.draft}
          canEdit={canEdit}
          onEdit={() => setView({ k: 'editor', mode: 'edit', termId: o.draft!.id })}
          onChanged={onChanged}
        />
      )}
      {!empty && canCreate && (
        <p className="mt-4 text-[13px] text-muted">
          Need to keep an old committee for the history?{' '}
          <button
            type="button"
            className="font-semibold text-navy underline"
            onClick={() => setView({ k: 'editor', mode: 'past' })}
          >
            Record a past committee
          </button>
        </p>
      )}
    </div>
  );
}

function daysChip(c: CurrentSummary) {
  const d = c.daysLeft;
  if (c.isOverdue || (d !== null && d < 0)) {
    const n = Math.abs(d ?? 0);
    return <Chip tone="warn">Overdue{d !== null ? ` by ${n} ${n === 1 ? 'day' : 'days'}` : ''}</Chip>;
  }
  if (d === null) return null;
  return (
    <Chip tone={d <= 90 ? 'warn' : 'ok'}>
      {d === 0 ? 'Ends today' : `${d} ${d === 1 ? 'day' : 'days'} left`}
    </Chip>
  );
}

function CurrentCard({
  current,
  canEdit,
  onChanged,
}: {
  current: CurrentSummary;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const detail = useLoad(() => committeeService.term(current.id), `${current.id}-${current.version}`);
  const [editing, setEditing] = useState(false);
  const t = detail.data;
  const seated = (t?.seats ?? []).filter(s => s.status === 'SEATED');
  const h = current.handover;
  const pct = h.total ? Math.round((h.done / h.total) * 100) : 0;
  return (
    <section aria-label="Current committee" className="mb-5">
      <Card className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold">{current.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
              <Chip tone={STATUS_TONE[current.status]}>
                {current.status === 'EXPIRED' ? 'Caretaker committee' : STATUS_LABEL[current.status]}
              </Chip>
              {daysChip(current)}
              <span>
                {shortDate(current.startDate)} to {shortDate(current.endDate)}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="glass" disabled={!t} onClick={() => setEditing(true)}>
                Edit term
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="glass" disabled title={COMING}>
                Make changes
              </Button>
            )}
          </div>
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Took charge on</dt>
            <dd className="font-semibold">{shortDate(current.tookChargeOn)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Seats filled</dt>
            <dd className="font-semibold">
              {current.seatedCount} of {current.strength} seats filled
            </dd>
          </div>
          {t?.resolutionRef && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Resolution</dt>
              <dd className="font-semibold">{t.resolutionRef}</dd>
            </div>
          )}
          {current.attentionCount > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Needs attention</dt>
              <dd className="font-semibold">
                {current.attentionCount} {current.attentionCount === 1 ? 'seat' : 'seats'}
              </dd>
            </div>
          )}
        </dl>
        {h.total > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[13px] text-muted">
              Hand-over checklist: {h.done} of {h.total} done{h.completedAt ? ' (complete)' : ''}
            </p>
            <div
              role="progressbar"
              aria-label="Hand-over checklist progress"
              aria-valuemin={0}
              aria-valuemax={h.total}
              aria-valuenow={h.done}
              className="h-2 w-full overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
            >
              <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </Card>
      <Loading load={detail} rows={2}>
        {term => <SeatsGrid term={term} current={current} />}
      </Loading>
      {editing && t && (
        <EditCurrentDialog
          term={t}
          seated={seated.length}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function SeatsGrid({ term, current }: { term: Term; current: CurrentSummary }) {
  const seated = term.seats
    .filter(s => s.status === 'SEATED')
    .sort((a, b) => DESIGNATION_ORDER.indexOf(a.designation) - DESIGNATION_ORDER.indexOf(b.designation));
  const vacantNamed = current.vacantDesignations;
  const generic = Math.max(0, current.vacancies - vacantNamed.length);
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Seats">
      {seated.map(s => (
        <SeatCard key={s.seatId} seat={s} />
      ))}
      {[...vacantNamed.map(d => `Vacant: ${designationLabel(d)}`), ...Array(generic).fill('Vacant seat')].map(
        (label: string, i) => (
          <li
            key={`v${i}`}
            className="flex items-center justify-between gap-2 rounded-[18px] border-2 border-dashed border-[var(--line)] p-3.5"
            data-testid="vacant-seat"
          >
            <span className="font-semibold text-muted">{label}</span>
            <Button size="xs" variant="glass" disabled title={COMING}>
              Fill
            </Button>
          </li>
        ),
      )}
    </ul>
  );
}

function DraftCard({
  draft,
  canEdit,
  onEdit,
  onChanged,
}: {
  draft: DraftSummary;
  canEdit: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const canDelete = usePermission(M.delete);
  const toast = useToast();
  const detail = useLoad(() => committeeService.term(draft.id), `${draft.id}-${draft.version}`);
  const [deleting, setDeleting] = useState(false);
  const t = detail.data;
  return (
    <section aria-label="Draft committee" className="mb-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold">{draft.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13.5px] text-muted">
              <Chip>Draft</Chip>
              <Chip tone={draft.source === 'ELECTION' ? 'info' : 'neutral'}>
                {SOURCE_LABEL[draft.source]}
              </Chip>
              {t && (
                <span>
                  {shortDate(t.startDate)} to {shortDate(t.endDate)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="glass" onClick={onEdit}>
                Edit draft
              </Button>
            )}
            {canEdit && (
              <Button size="sm" disabled title={COMING}>
                Preview and activate
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="danger-soft" onClick={() => setDeleting(true)}>
                Delete draft
              </Button>
            )}
          </div>
        </div>
        <Section title={`Seats (${t?.seats.length ?? draft.seatCount})`}>
          <Loading load={detail} rows={2}>
            {term => (
              <ul className="grid gap-3 sm:grid-cols-2" aria-label="Draft seats">
                {term.seats
                  .filter(s => s.status !== 'LEFT')
                  .sort(
                    (a, b) =>
                      DESIGNATION_ORDER.indexOf(a.designation) - DESIGNATION_ORDER.indexOf(b.designation),
                  )
                  .map(s => (
                    <SeatCard key={s.seatId} seat={s} />
                  ))}
              </ul>
            )}
          </Loading>
        </Section>
      </Card>
      {deleting && (
        <ConfirmReason
          open
          title={`Delete the draft "${draft.name}"?`}
          description="The draft is removed. Roles do not change."
          confirmLabel="Delete draft"
          onCancel={() => setDeleting(false)}
          onConfirm={async reason => {
            try {
              await committeeService.deleteTerm(draft.id, { version: draft.version, reason });
              toast.show('Draft deleted.');
              setDeleting(false);
              onChanged();
            } catch (e) {
              toast.show(committeeError(e), 'error');
            }
          }}
        />
      )}
    </section>
  );
}

'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { downloadBlob } from '@/components/maintenance/ledger/format';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { todayIST } from '@/lib/indiaDate';
import { surveysService } from '@/services/surveys.service';
import type { QuestionResult } from '@/types/surveys';
import { TYPE_LABEL, noticeError, pct, plainError } from './format';

function Bar({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="text-muted">{text}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-[rgba(20,35,44,0.1)]"
      >
        <div className="h-full rounded-full bg-navy" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function Question({ q }: { q: QuestionResult }) {
  return (
    <section className="mb-4 rounded-2xl bg-white/50 p-3" aria-label={q.prompt || TYPE_LABEL[q.type]}>
      <h3 className="text-[14.5px] font-bold">{q.prompt || TYPE_LABEL[q.type]}</h3>
      <p className="mb-2 text-[12.5px] text-muted">
        {TYPE_LABEL[q.type]} · {q.answered} answered
      </p>
      {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTI_CHOICE' || q.type === 'YES_NO') &&
        q.options.map(o => (
          <Bar key={o.key} label={o.label} value={Number(o.pct)} text={`${o.count} · ${o.pct}%`} />
        ))}
      {q.type === 'RATING' && (
        <>
          <p className="mb-1 text-[22px] font-bold" data-testid="rating-average">
            {q.average ?? '-'} <span className="text-[13px] font-semibold text-muted">average</span>
          </p>
          {['5', '4', '3', '2', '1'].map(k => (
            <Bar
              key={k}
              label={`${k} star${k === '1' ? '' : 's'}`}
              value={pct(q.distribution[k] ?? 0, q.answered)}
              text={String(q.distribution[k] ?? 0)}
            />
          ))}
        </>
      )}
      {q.type === 'NPS' && (
        <>
          <p className="mb-1 text-[22px] font-bold" data-testid="nps-score">
            {q.nps ?? '-'} <span className="text-[13px] font-semibold text-muted">NPS</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="ok">{q.promoters} promoters</Chip>
            <Chip>{q.passives} passives</Chip>
            <Chip tone="bad">{q.detractors} detractors</Chip>
          </div>
        </>
      )}
      {q.type === 'TEXT' &&
        (q.hidden ? (
          <p className="text-[13px] text-muted">Answers are hidden until at least 5 people have responded.</p>
        ) : q.samples.length === 0 ? (
          <p className="text-[13px] text-muted">No written answers yet.</p>
        ) : (
          <ul className="list-disc pl-5 text-[13.5px]">
            {q.samples.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ))}
      {(q.type === 'NUMBER' || q.type === 'DATE') &&
        q.answered > 0 &&
        q.options.length === 0 &&
        q.average && (
          <p className="text-[13.5px]">
            Average {q.average}
            {q.min != null && q.max != null && ` (smallest ${q.min}, largest ${q.max})`}
          </p>
        )}
    </section>
  );
}

/** Results of a survey (spec 11.5): a bar per choice, rating distribution, NPS, text answers and the CSV. */
export function SurveyResultsDrawer({
  id,
  title,
  canExport,
  onClose,
}: {
  id: number;
  title: string;
  canExport: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const load = useLoad(() => surveysService.results(id), String(id));
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await surveysService.exportResults(id), `survey-${id}-results-${todayIST()}.csv`);
    } catch (e) {
      toast.show(noticeError(e), 'error');
    } finally {
      setExporting(false);
    }
  };
  const r = load.data;
  return (
    <Drawer open onClose={onClose} title={`Results: ${title}`} size={640}>
      {load.error != null ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : !r ? (
        <div aria-busy="true" aria-label="Loading" className="skeleton h-40 w-full" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[14px] font-semibold" data-testid="response-count">
              {r.responses} of {r.recipients} responded{r.isAnonymous && ' · anonymous'}
            </p>
            {canExport && (
              <Button size="sm" variant="glass" loading={exporting} onClick={() => void exportCsv()}>
                Export CSV
              </Button>
            )}
          </div>
          {r.questions.map(q => (
            <Question key={q.questionId} q={q} />
          ))}
        </>
      )}
    </Drawer>
  );
}

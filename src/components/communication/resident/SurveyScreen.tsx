'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { cx } from '@/components/ui/cx';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { residentNoticesService as svc } from '@/services/residentNotices.service';
import type { SurveyAnswer, SurveyDetail, SurveyQuestion } from '@/types/residentNotices';
import { commError, istDate, plainCommError } from '../format';

export function SurveyScreen({ id }: { id: number }) {
  return (
    <Gate view={PERMISSIONS.resident.notices.view} title="Surveys">
      <Inner id={id} />
    </Gate>
  );
}

/** What a person typed or picked for one question, kept as simple values until submit. */
type Value = { key?: string; keys?: string[]; text?: string };

export function answerFor(q: SurveyQuestion, v: Value | undefined): SurveyAnswer | null {
  if (!v) return null;
  switch (q.type) {
    case 'SINGLE_CHOICE':
    case 'YES_NO':
      return v.key ? { questionId: q.id, optionKey: v.key } : null;
    case 'MULTI_CHOICE':
      return v.keys && v.keys.length > 0 ? { questionId: q.id, optionKeys: v.keys } : null;
    case 'RATING':
    case 'NPS':
    case 'NUMBER': {
      if (v.text === undefined || v.text.trim() === '') return null;
      const n = Number(v.text);
      return Number.isFinite(n) ? { questionId: q.id, number: n } : null;
    }
    case 'TEXT':
      return v.text?.trim() ? { questionId: q.id, text: v.text.trim() } : null;
    case 'DATE':
      return v.text ? { questionId: q.id, date: v.text } : null;
  }
}

/** Returns a plain problem text, or null when the answer fits. */
export function problemFor(q: SurveyQuestion, v: Value | undefined): string | null {
  const a = answerFor(q, v);
  if (!a) return q.isRequired ? 'This question needs an answer.' : null;
  if (a.number !== undefined) {
    const [lo, hi] = q.type === 'RATING' ? [1, 5] : q.type === 'NPS' ? [0, 10] : [q.minValue, q.maxValue];
    if (!Number.isInteger(a.number) && q.type !== 'NUMBER') return 'Choose a whole number.';
    if (lo != null && a.number < lo) return `Enter ${lo} or more.`;
    if (hi != null && a.number > hi) return `Enter ${hi} or less.`;
  }
  if (a.text && q.maxLength && a.text.length > q.maxLength)
    return `Keep it within ${q.maxLength} characters.`;
  if (a.optionKeys && q.maxSelections && a.optionKeys.length > q.maxSelections)
    return `Choose at most ${q.maxSelections}.`;
  return null;
}

function QuestionInput({
  q,
  v,
  onChange,
}: {
  q: SurveyQuestion;
  v: Value | undefined;
  onChange: (v: Value) => void;
}) {
  const scale = (from: number, to: number) => (
    <div role="radiogroup" aria-label={q.prompt} className="flex flex-wrap gap-2">
      {Array.from({ length: to - from + 1 }, (_, i) => from + i).map(n => (
        <button
          key={n}
          role="radio"
          aria-checked={v?.text === String(n)}
          onClick={() => onChange({ text: String(n) })}
          className={cx(
            'h-11 w-11 rounded-full text-[15px] font-bold',
            v?.text === String(n) ? 'bg-navy text-[#FDF8EE]' : 'bg-white/70 hover:bg-white',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
  switch (q.type) {
    case 'SINGLE_CHOICE':
    case 'YES_NO': {
      const opts =
        q.type === 'YES_NO'
          ? [
              { key: 'yes', label: 'Yes' },
              { key: 'no', label: 'No' },
            ]
          : q.options;
      return (
        <div role="radiogroup" aria-label={q.prompt} className="grid gap-2">
          {opts.map(o => (
            <button
              key={o.key}
              role="radio"
              aria-checked={v?.key === o.key}
              onClick={() => onChange({ key: o.key })}
              className={cx(
                'rounded-2xl px-4 py-3 text-left text-[15px] font-semibold',
                v?.key === o.key ? 'bg-navy text-[#FDF8EE]' : 'bg-white/70 hover:bg-white',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    case 'MULTI_CHOICE': {
      const keys = v?.keys ?? [];
      return (
        <fieldset>
          <legend className="sr-only">{q.prompt}</legend>
          {q.options.map(o => (
            <Checkbox
              key={o.key}
              label={o.label}
              checked={keys.includes(o.key)}
              onChange={e =>
                onChange({ keys: e.target.checked ? [...keys, o.key] : keys.filter(k => k !== o.key) })
              }
            />
          ))}
          {q.maxSelections && <p className="text-[12.5px] text-muted">Choose up to {q.maxSelections}.</p>}
        </fieldset>
      );
    }
    case 'RATING':
      return scale(1, 5);
    case 'NPS':
      return scale(0, 10);
    case 'NUMBER':
      return (
        <Input
          label="Your answer"
          type="number"
          inputMode="numeric"
          min={q.minValue ?? undefined}
          max={q.maxValue ?? undefined}
          value={v?.text ?? ''}
          onChange={e => onChange({ text: e.target.value })}
        />
      );
    case 'DATE':
      return (
        <Input
          label="Date"
          type="date"
          value={v?.text ?? ''}
          onChange={e => onChange({ text: e.target.value })}
        />
      );
    case 'TEXT':
      return (
        <Textarea
          label="Your answer"
          rows={4}
          maxLength={q.maxLength ?? 500}
          value={v?.text ?? ''}
          onChange={e => onChange({ text: e.target.value })}
        />
      );
  }
}

function Results({ s }: { s: SurveyDetail }) {
  const r = s.results!;
  return (
    <Card title="Results" sub={`${r.responses} of ${r.recipients} answered`}>
      {r.questions.map(q => (
        <div key={q.questionId} className="mb-4">
          <p className="text-[14.5px] font-bold">{q.prompt}</p>
          {q.options.map(o => (
            <p key={o.key} className="text-[13.5px]">
              {o.label}: {o.count} ({o.pct}%)
            </p>
          ))}
          {q.average && <p className="text-[13.5px]">Average {q.average}</p>}
          {q.nps !== null && <p className="text-[13.5px]">NPS {q.nps}</p>}
          {q.samples.map((t, i) => (
            <p key={i} className="text-[13.5px] text-muted">
              “{t}”
            </p>
          ))}
        </div>
      ))}
    </Card>
  );
}

function Inner({ id }: { id: number }) {
  const canAnswer = usePermission(PERMISSIONS.resident.notices.edit);
  const q = useLoad(() => svc.survey(id), id);
  const [values, setValues] = useState<Record<number, Value>>({});
  const [step, setStep] = useState(0);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const s = q.data;

  if (q.loading)
    return (
      <Page>
        <div className="skeleton h-48 w-full" />
      </Page>
    );
  if (!s)
    return (
      <Page>
        <ErrorState
          error={plainCommError(q.error)}
          action={<Button onClick={q.reload}>Try again</Button>}
          notFoundAction={
            <Link href="/resident/notices" className={buttonClasses('primary', 'md')}>
              Back to notices
            </Link>
          }
        />
      </Page>
    );

  const total = s.questions.length;
  const review = step >= total;
  const flat = s.responseScope === 'FLAT' && s.units.length > 1;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const answers = s.questions.map(x => answerFor(x, values[x.id])).filter((a): a is SurveyAnswer => !!a);
      await svc.submitSurvey(s.id, { ...(flat && unitId ? { unitId } : {}), answers });
      setDone(true);
    } catch (e) {
      setError(commError(e));
      if (e instanceof ApiError && e.code === 'SURVEY_ALREADY_RESPONDED') setDone(true);
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    const cur = s.questions[step];
    const p = problemFor(cur, values[cur.id]);
    setProblem(p);
    if (!p) setStep(step + 1);
  };

  return (
    <Page>
      <p className="mb-2 text-[13px]">
        <Link href="/resident/notices" className="font-semibold text-navy hover:underline">
          Notices
        </Link>
      </p>
      <PageHead title={s.title} sub={s.closesAt ? `Closes ${istDate(s.closesAt)}` : undefined} />
      {s.results ? (
        <Results s={s} />
      ) : done || s.responded ? (
        <Card>
          <Alert tone="ok">Thank you. Your answers are recorded.</Alert>
          <Link href="/resident/notices" className={buttonClasses('primary', 'md')}>
            Back to notices
          </Link>
        </Card>
      ) : s.status !== 'OPEN' ? (
        <Card>
          <Alert tone="info">This survey is closed.</Alert>
        </Card>
      ) : !canAnswer ? (
        <Card>
          <Alert tone="info">You do not have permission to answer surveys.</Alert>
        </Card>
      ) : (
        <Card>
          {error && <Alert tone="bad">{error}</Alert>}
          {step === 0 && s.description && <p className="mb-3 text-[14px] text-muted">{s.description}</p>}
          {step === 0 && s.isAnonymous && (
            <Alert tone="info">This survey is anonymous. Your name is not stored with your answers.</Alert>
          )}
          {!review ? (
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-muted">
                Question {step + 1} of {total}
                {s.questions[step].isRequired ? '' : ' (optional)'}
              </p>
              <h2 className="mb-3 text-[18px] font-bold">{s.questions[step].prompt}</h2>
              {s.questions[step].helpText && (
                <p className="mb-3 text-[13.5px] text-muted">{s.questions[step].helpText}</p>
              )}
              <QuestionInput
                q={s.questions[step]}
                v={values[s.questions[step].id]}
                onChange={v => {
                  setProblem(null);
                  setValues(all => ({ ...all, [s.questions[step].id]: v }));
                }}
              />
              {problem && (
                <p role="alert" className="mt-2 text-[13px] font-medium text-bad">
                  {problem}
                </p>
              )}
              <div className="mt-4 flex justify-between gap-2">
                <Button
                  variant="glass"
                  disabled={step === 0}
                  onClick={() => {
                    setProblem(null);
                    setStep(step - 1);
                  }}
                >
                  Back
                </Button>
                <Button onClick={next}>{step === total - 1 ? 'Review' : 'Next'}</Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="mb-3 text-[18px] font-bold">Review your answers</h2>
              <ul className="mb-4 grid gap-2">
                {s.questions.map((x, i) => {
                  const a = answerFor(x, values[x.id]);
                  const label =
                    a?.optionKey !== undefined
                      ? x.type === 'YES_NO'
                        ? a.optionKey === 'yes'
                          ? 'Yes'
                          : 'No'
                        : x.options.find(o => o.key === a.optionKey)?.label
                      : a?.optionKeys
                        ? a.optionKeys.map(k => x.options.find(o => o.key === k)?.label ?? k).join(', ')
                        : (a?.number ?? a?.text ?? a?.date);
                  return (
                    <li key={x.id} className="rounded-2xl bg-white/60 p-3 text-[14px]">
                      <span className="font-semibold">{x.prompt}</span>
                      <br />
                      <span className="text-muted">
                        {label !== undefined ? String(label) : 'Skipped'}
                      </span>{' '}
                      <button className="font-semibold text-navy underline" onClick={() => setStep(i)}>
                        Change
                      </button>
                    </li>
                  );
                })}
              </ul>
              {flat && (
                <Select
                  label="Answer for flat"
                  value={String(unitId ?? '')}
                  onChange={e => setUnitId(Number(e.target.value))}
                  options={[
                    { value: '', label: 'Choose a flat' },
                    ...s.units.map(u => ({ value: String(u.unitId), label: u.label })),
                  ]}
                />
              )}
              <p className="mb-3 text-[12.5px] text-muted">Answers cannot be changed after you submit.</p>
              <Button loading={busy} disabled={flat && !unitId} onClick={() => void submit()}>
                Submit answers
              </Button>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}

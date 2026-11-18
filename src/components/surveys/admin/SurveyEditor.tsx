'use client';
import { useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import {
  AudienceBuilder,
  EMPTY_AUDIENCE,
  audienceInput,
  type AudienceState,
} from '@/components/notices/admin/AudienceBuilder';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { surveysService } from '@/services/surveys.service';
import type { ResponseScope, ResultsVisibility, Survey, SurveyInput } from '@/types/surveys';
import {
  TYPE_LABEL,
  VISIBILITY_LABEL,
  blankQuestion,
  isChoice,
  isoToLocal,
  localToIso,
  noticeError,
  plainError,
  questionForm,
  questionInput,
  surveyProblems,
  type QuestionForm,
} from './format';

interface Props {
  surveyId?: number;
  canPublish: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Survey editor (spec 11.5): settings, then question cards with type, prompt, options, required and reorder. */
export function SurveyEditor(props: Props) {
  const { surveyId, onClose } = props;
  const existing = useLoad<Survey | null>(
    () => (surveyId ? surveysService.get(surveyId) : Promise.resolve(null)),
    String(surveyId ?? 'new'),
  );
  if (existing.error != null || existing.loading)
    return (
      <Drawer open onClose={onClose} size={640} title="Edit survey">
        {existing.error != null ? (
          <ErrorState
            error={plainError(existing.error)}
            action={
              <Button size="sm" onClick={existing.reload}>
                Try again
              </Button>
            }
          />
        ) : (
          <div aria-busy="true" aria-label="Loading" className="skeleton h-40 w-full" />
        )}
      </Drawer>
    );
  return <EditorForm key={existing.data?.id ?? 'new'} {...props} survey={existing.data} />;
}

function EditorForm({
  surveyId,
  canPublish,
  onClose,
  onSaved,
  survey: s,
}: Props & { survey: Survey | null }) {
  const toast = useToast();
  const [title, setTitle] = useState(s?.title ?? '');
  const [description, setDescription] = useState(s?.description ?? '');
  const [anonymous, setAnonymous] = useState(s?.isAnonymous ?? false);
  const [scope, setScope] = useState<ResponseScope>(s?.responseScope ?? 'PERSON');
  const [visibility, setVisibility] = useState<ResultsVisibility>(s?.resultsVisibility ?? 'ADMINS');
  const [audience, setAudience] = useState<AudienceState>(() =>
    s
      ? {
          ...EMPTY_AUDIENCE,
          type: s.audience.type,
          relation: (s.audience.relation as AudienceState['relation']) || 'ANY',
          buildingIds: s.audience.type === 'BUILDINGS' ? (s.audience.ids ?? []) : [],
          units:
            s.audience.type === 'UNITS'
              ? (s.audience.ids ?? []).map(id => ({ id, label: `Flat ${id}` }))
              : [],
        }
      : EMPTY_AUDIENCE,
  );
  const [closesAt, setClosesAt] = useState(isoToLocal(s?.closesAt));
  const [questions, setQuestions] = useState<QuestionForm[]>(() => (s ? s.questions.map(questionForm) : []));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const problems = surveyProblems(title, questions, false);
  const publishProblems = surveyProblems(title, questions, true);
  const move = (i: number, d: -1 | 1) =>
    setQuestions(qs => {
      const j = i + d;
      if (j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const patch = (uid: number, p: Partial<QuestionForm>) =>
    setQuestions(qs => qs.map(q => (q.uid === uid ? { ...q, ...p } : q)));

  const body = (): SurveyInput => {
    const a = audienceInput(audience);
    return {
      title: title.trim(),
      description: description.trim(),
      isAnonymous: anonymous,
      responseScope: scope,
      resultsVisibility: visibility,
      audience:
        a && a.type !== 'ROLES'
          ? { type: a.type, relation: a.relation, ...(a.ids ? { ids: a.ids } : {}) }
          : { type: 'ALL', relation: 'ANY' },
      ...(closesAt ? { closesAt: localToIso(closesAt) } : {}),
      questions: questions.map(questionInput),
    };
  };

  const save = async (): Promise<Survey> =>
    s ? surveysService.update(s.id, { ...body(), version: s.version }) : surveysService.create(body());

  const run = async (kind: 'save' | 'publish') => {
    setShowErrors(true);
    const p = kind === 'publish' ? publishProblems : problems;
    if (Object.keys(p).length) return;
    if (kind === 'publish' && !closesAt) {
      setProblem('Choose when the survey closes.');
      return;
    }
    setBusy(kind);
    setProblem(null);
    try {
      const saved = await save();
      if (kind === 'publish') {
        await surveysService.publish(saved.id, { version: saved.version, closesAt: localToIso(closesAt) });
        toast.show('Survey opened');
      } else toast.show('Draft saved');
      onSaved();
    } catch (e) {
      setProblem(noticeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      size={640}
      title={surveyId ? 'Edit survey' : 'New survey'}
      footer={
        <>
          <Button
            variant="glass"
            loading={busy === 'save'}
            disabled={busy !== null}
            onClick={() => void run('save')}
          >
            Save draft
          </Button>
          {canPublish && (
            <Button loading={busy === 'publish'} disabled={busy !== null} onClick={() => void run('publish')}>
              Open survey
            </Button>
          )}
        </>
      }
    >
      <form onSubmit={e => e.preventDefault()} noValidate>
        {problem && (
          <p
            role="alert"
            className="mb-3 rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] font-medium text-[#8a1d17]"
          >
            {problem}
          </p>
        )}
        <Input
          label="Title"
          value={title}
          maxLength={150}
          error={showErrors ? problems.title : undefined}
          onChange={e => setTitle(e.target.value)}
        />
        <Textarea
          label="Description (optional)"
          value={description}
          maxLength={2000}
          onChange={e => setDescription(e.target.value)}
        />
        <Checkbox
          label="Anonymous: answers are never linked to a person or flat"
          checked={anonymous}
          onChange={e => setAnonymous(e.target.checked)}
          className="!mb-1"
        />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Select
            label="One answer per"
            value={scope}
            onChange={e => setScope(e.target.value as ResponseScope)}
            options={[
              { value: 'PERSON', label: 'Person' },
              { value: 'FLAT', label: 'Flat' },
            ]}
          />
          <Select
            label="Who sees the results"
            value={visibility}
            onChange={e => setVisibility(e.target.value as ResultsVisibility)}
            options={Object.entries(VISIBILITY_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </div>
        <AudienceBuilder
          value={audience}
          onChange={setAudience}
          types={['ALL', 'BUILDINGS', 'UNITS']}
          preview={false}
        />
        <Input
          label="Closes on"
          type="datetime-local"
          hint="Between 1 hour and 90 days after it opens."
          value={closesAt}
          onChange={e => setClosesAt(e.target.value)}
        />

        <h3 className="mb-2 mt-4 text-[15px] font-bold">Questions</h3>
        {showErrors && publishProblems.questions && (
          <p role="alert" className="mb-2 text-[12.5px] font-medium text-bad">
            {publishProblems.questions}
          </p>
        )}
        <ol className="grid gap-3" aria-label="Questions">
          {questions.map((q, i) => (
            <li key={q.uid} className="rounded-2xl bg-white/50 p-3" aria-label={`Question ${i + 1}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">Question {i + 1}</span>
                <span className="flex gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={`Move question ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={`Move question ${i + 1} down`}
                    disabled={i === questions.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    size="xs"
                    variant="danger-soft"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() => setQuestions(qs => qs.filter(x => x.uid !== q.uid))}
                  >
                    Remove
                  </Button>
                </span>
              </div>
              <Select
                label="Type"
                value={q.type}
                onChange={e => {
                  const type = e.target.value as QuestionForm['type'];
                  patch(q.uid, {
                    type,
                    options: isChoice(type) ? (q.options.length ? q.options : ['', '']) : [],
                  });
                }}
                options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <Input
                label="Question"
                value={q.prompt}
                maxLength={300}
                error={showErrors ? problems[`q${q.uid}`] : undefined}
                onChange={e => patch(q.uid, { prompt: e.target.value })}
              />
              <Input
                label="Help text (optional)"
                value={q.helpText}
                maxLength={300}
                onChange={e => patch(q.uid, { helpText: e.target.value })}
              />
              {isChoice(q.type) && (
                <div className="mb-3">
                  {q.options.map((o, oi) => (
                    <div key={oi} className="mb-1.5 flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          label={`Option ${oi + 1}`}
                          value={o}
                          maxLength={100}
                          onChange={e =>
                            patch(q.uid, {
                              options: q.options.map((x, k) => (k === oi ? e.target.value : x)),
                            })
                          }
                        />
                      </div>
                      {q.options.length > 2 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mb-4"
                          aria-label={`Remove option ${oi + 1}`}
                          onClick={() => patch(q.uid, { options: q.options.filter((_, k) => k !== oi) })}
                        >
                          x
                        </Button>
                      )}
                    </div>
                  ))}
                  {q.options.length < 20 && (
                    <Button
                      size="sm"
                      variant="glass"
                      onClick={() => patch(q.uid, { options: [...q.options, ''] })}
                    >
                      Add option
                    </Button>
                  )}
                  {q.type === 'MULTI_CHOICE' && (
                    <Input
                      label="Most choices allowed (optional)"
                      type="number"
                      min={1}
                      value={q.maxSelections}
                      onChange={e => patch(q.uid, { maxSelections: e.target.value })}
                    />
                  )}
                </div>
              )}
              {q.type === 'NUMBER' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Smallest value"
                    type="number"
                    value={q.minValue}
                    onChange={e => patch(q.uid, { minValue: e.target.value })}
                  />
                  <Input
                    label="Largest value"
                    type="number"
                    value={q.maxValue}
                    onChange={e => patch(q.uid, { maxValue: e.target.value })}
                  />
                </div>
              )}
              {q.type === 'TEXT' && (
                <Input
                  label="Longest answer (characters)"
                  type="number"
                  min={1}
                  max={1000}
                  value={q.maxLength}
                  onChange={e => patch(q.uid, { maxLength: e.target.value })}
                />
              )}
              <Checkbox
                label="Required"
                checked={q.isRequired}
                onChange={e => patch(q.uid, { isRequired: e.target.checked })}
                className="!mb-0"
              />
            </li>
          ))}
        </ol>
        {questions.length < 30 && (
          <Button
            className="mt-3"
            variant="glass"
            onClick={() => setQuestions(qs => [...qs, blankQuestion()])}
          >
            Add question
          </Button>
        )}
      </form>
    </Drawer>
  );
}

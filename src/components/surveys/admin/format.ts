import type { Tone } from '@/components/ui/Chip';
import type {
  QuestionType,
  ResultsVisibility,
  SurveyQuestion,
  SurveyQuestionInput,
  SurveyStatus,
} from '@/types/surveys';
export {
  dateTime,
  noticeError,
  plainError,
  isStale,
  localToIso,
  isoToLocal,
  pct,
} from '@/components/notices/admin/format';

export const STATUS_LABEL: Record<SurveyStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};
export const statusTone = (s: SurveyStatus): Tone =>
  s === 'OPEN' ? 'ok' : s === 'DRAFT' ? 'info' : s === 'CANCELLED' ? 'bad' : 'neutral';

export const TYPE_LABEL: Record<QuestionType, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTI_CHOICE: 'Multiple choice',
  YES_NO: 'Yes or no',
  RATING: 'Rating (1 to 5)',
  NPS: 'Recommend (0 to 10)',
  NUMBER: 'Number',
  TEXT: 'Text answer',
  DATE: 'Date',
};
export const VISIBILITY_LABEL: Record<ResultsVisibility, string> = {
  ADMINS: 'Only admins',
  RESPONDENTS_AFTER_CLOSE: 'People who answered, after it closes',
  ALL_AFTER_CLOSE: 'Everyone, after it closes',
};
export const isChoice = (t: QuestionType) => t === 'SINGLE_CHOICE' || t === 'MULTI_CHOICE';

export interface QuestionForm {
  uid: number;
  type: QuestionType;
  prompt: string;
  helpText: string;
  isRequired: boolean;
  options: string[];
  maxSelections: string;
  minValue: string;
  maxValue: string;
  maxLength: string;
}
let uid = 0;
export const blankQuestion = (type: QuestionType = 'SINGLE_CHOICE'): QuestionForm => ({
  uid: ++uid,
  type,
  prompt: '',
  helpText: '',
  isRequired: true,
  options: isChoice(type) ? ['', ''] : [],
  maxSelections: '',
  minValue: '',
  maxValue: '',
  maxLength: '',
});
export const questionForm = (q: SurveyQuestion): QuestionForm => ({
  uid: ++uid,
  type: q.type,
  prompt: q.prompt,
  helpText: q.helpText,
  isRequired: q.isRequired,
  options: q.options.map(o => o.label),
  maxSelections: q.maxSelections != null ? String(q.maxSelections) : '',
  minValue: q.minValue != null ? String(q.minValue) : '',
  maxValue: q.maxValue != null ? String(q.maxValue) : '',
  maxLength: q.maxLength != null ? String(q.maxLength) : '',
});

/** One question of the API body (spec 8.31, 7.11): only the fields its type allows, option keys `o1`, `o2` ... */
export function questionInput(q: QuestionForm): SurveyQuestionInput {
  const out: SurveyQuestionInput = { type: q.type, prompt: q.prompt.trim(), isRequired: q.isRequired };
  if (q.helpText.trim()) out.helpText = q.helpText.trim();
  if (isChoice(q.type)) {
    out.options = q.options
      .map(o => o.trim())
      .filter(Boolean)
      .map((label, i) => ({ key: `o${i + 1}`, label }));
    if (q.type === 'MULTI_CHOICE' && q.maxSelections) out.maxSelections = Number(q.maxSelections);
  }
  if (q.type === 'NUMBER') {
    if (q.minValue !== '') out.minValue = Number(q.minValue);
    if (q.maxValue !== '') out.maxValue = Number(q.maxValue);
  }
  if (q.type === 'TEXT' && q.maxLength) out.maxLength = Number(q.maxLength);
  return out;
}

/** Problems in wording of the API; keys are `title`, `questions` or `q<uid>`. */
export function surveyProblems(
  title: string,
  questions: QuestionForm[],
  forPublish: boolean,
): Record<string, string> {
  const p: Record<string, string> = {};
  if (title.trim().length < 5) p.title = 'Add a title (5+ characters).';
  if (forPublish && questions.length === 0) p.questions = 'Add at least one question.';
  if (questions.length > 30) p.questions = 'A survey can have at most 30 questions.';
  for (const q of questions) {
    if (q.prompt.trim().length < 3) p[`q${q.uid}`] = 'Write the question (3+ characters).';
    else if (isChoice(q.type) && q.options.map(o => o.trim()).filter(Boolean).length < 2)
      p[`q${q.uid}`] = 'A choice question needs 2 or more options.';
    else if (
      q.type === 'NUMBER' &&
      q.minValue !== '' &&
      q.maxValue !== '' &&
      Number(q.maxValue) <= Number(q.minValue)
    )
      p[`q${q.uid}`] = 'The largest value must be above the smallest.';
  }
  return p;
}

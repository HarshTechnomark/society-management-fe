/** Response mapping for the module 16 admin survey calls (spec 8.31 to 8.33). */
import { arr, num, numOrNull, obj, str, strOrNull } from './helpdeskMappers';
import type {
  OptionResult,
  QuestionResult,
  QuestionType,
  Survey,
  SurveyList,
  SurveyListItem,
  SurveyQuestion,
  SurveyResults,
  SurveyStatus,
} from '@/types/surveys';

const option = (v: unknown) => {
  const o = obj(v);
  return { key: str(o.key), label: str(o.label) };
};

export function mapListItem(raw: unknown): SurveyListItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    title: str(r.title),
    status: str(r.status, 'DRAFT') as SurveyStatus,
    isAnonymous: r.isAnonymous === true,
    closesAt: strOrNull(r.closesAt),
    recipientCount: num(r.recipientCount),
    responseCount: num(r.responseCount),
    questionCount: num(r.questionCount),
    version: num(r.version, 1),
  };
}
export function mapList(rows: unknown, pagination?: { total?: number; totalPages?: number }): SurveyList {
  const items = arr(rows).map(mapListItem);
  return {
    items,
    total: pagination?.total ?? items.length,
    totalPages: Math.max(1, pagination?.totalPages ?? 1),
  };
}

export function mapQuestion(raw: unknown): SurveyQuestion {
  const r = obj(raw);
  return {
    id: numOrNull(r.id),
    type: str(r.type, 'TEXT') as QuestionType,
    prompt: str(r.prompt),
    helpText: str(r.helpText),
    isRequired: r.isRequired !== false,
    options: arr(r.options).map(option),
    maxSelections: numOrNull(r.maxSelections),
    minValue: numOrNull(r.minValue),
    maxValue: numOrNull(r.maxValue),
    maxLength: numOrNull(r.maxLength),
  };
}

export function mapSurvey(raw: unknown): Survey {
  const r = obj(raw);
  const a = obj(r.audience);
  return {
    id: num(r.id),
    title: str(r.title),
    description: str(r.description),
    status: str(r.status, 'DRAFT') as SurveyStatus,
    isAnonymous: r.isAnonymous === true,
    responseScope: str(r.responseScope, 'PERSON') as Survey['responseScope'],
    resultsVisibility: str(r.resultsVisibility, 'ADMINS') as Survey['resultsVisibility'],
    audience: {
      type: str(a.type ?? r.audienceType, 'ALL') as Survey['audience']['type'],
      relation: str(a.relation ?? r.audienceRelation, 'ANY'),
      ids: Array.isArray(a.ids ?? r.audienceIds)
        ? ((a.ids ?? r.audienceIds) as unknown[]).map(x => num(x))
        : null,
      label: str(a.label ?? r.audienceLabel, 'All residents'),
    },
    closesAt: strOrNull(r.closesAt),
    recipientCount: num(r.recipientCount),
    responseCount: num(r.responseCount),
    questions: arr(r.questions).map(mapQuestion),
    version: num(r.version, 1),
  };
}

function mapOptionResult(v: unknown): OptionResult {
  const o = obj(v);
  return { key: str(o.key), label: str(o.label), count: num(o.count), pct: str(o.pct, '0.0') };
}

export function mapQuestionResult(raw: unknown): QuestionResult {
  const r = obj(raw);
  const dist: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.distribution))) dist[k] = num(v);
  return {
    questionId: num(r.questionId),
    type: str(r.type, 'TEXT') as QuestionType,
    prompt: str(r.prompt),
    answered: num(r.answered),
    options: arr(r.options).map(mapOptionResult),
    average: strOrNull(r.average),
    min: numOrNull(r.min),
    max: numOrNull(r.max),
    distribution: dist,
    nps: numOrNull(r.nps),
    promoters: num(r.promoters),
    passives: num(r.passives),
    detractors: num(r.detractors),
    samples: arr(r.samples).map(x => str(x)),
    hidden: r.hidden === true,
  };
}

export function mapResults(raw: unknown): SurveyResults {
  const r = obj(raw);
  return {
    surveyId: num(r.surveyId),
    status: str(r.status, 'OPEN') as SurveyStatus,
    responses: num(r.responses),
    recipients: num(r.recipients),
    isAnonymous: r.isAnonymous === true,
    questions: arr(r.questions).map(mapQuestionResult),
  };
}

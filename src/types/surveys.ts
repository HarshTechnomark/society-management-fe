/** Module 16 admin survey shapes (spec 8.31 to 8.33, 7.10, 7.11). */
export type SurveyStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type QuestionType =
  'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'YES_NO' | 'RATING' | 'NPS' | 'NUMBER' | 'TEXT' | 'DATE';
export type ResponseScope = 'PERSON' | 'FLAT';
export type ResultsVisibility = 'ADMINS' | 'RESPONDENTS_AFTER_CLOSE' | 'ALL_AFTER_CLOSE';

export interface SurveyListItem {
  id: number;
  title: string;
  status: SurveyStatus;
  isAnonymous: boolean;
  closesAt: string | null;
  recipientCount: number;
  responseCount: number;
  questionCount: number;
  version: number;
}
export interface SurveyList {
  items: SurveyListItem[];
  total: number;
  totalPages: number;
}

export interface SurveyOption {
  key: string;
  label: string;
}
export interface SurveyQuestion {
  id: number | null;
  type: QuestionType;
  prompt: string;
  helpText: string;
  isRequired: boolean;
  options: SurveyOption[];
  maxSelections: number | null;
  minValue: number | null;
  maxValue: number | null;
  maxLength: number | null;
}
export interface Survey {
  id: number;
  title: string;
  description: string;
  status: SurveyStatus;
  isAnonymous: boolean;
  responseScope: ResponseScope;
  resultsVisibility: ResultsVisibility;
  audience: { type: 'ALL' | 'BUILDINGS' | 'UNITS'; relation: string; ids: number[] | null; label: string };
  closesAt: string | null;
  recipientCount: number;
  responseCount: number;
  questions: SurveyQuestion[];
  version: number;
}
export interface SurveyListQuery {
  status?: string;
  q?: string;
  sortBy?: 'createdAt' | 'closesAt' | 'responseCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
export interface SurveyQuestionInput {
  type: QuestionType;
  prompt: string;
  helpText?: string;
  isRequired?: boolean;
  options?: SurveyOption[] | string[];
  maxSelections?: number;
  minValue?: number;
  maxValue?: number;
  maxLength?: number;
}
export interface SurveyInput {
  title?: string;
  description?: string;
  isAnonymous?: boolean;
  responseScope?: ResponseScope;
  resultsVisibility?: ResultsVisibility;
  audience?: { type: 'ALL' | 'BUILDINGS' | 'UNITS'; relation?: string; ids?: number[] };
  closesAt?: string | null;
  questions?: SurveyQuestionInput[];
  version?: number;
}

export interface OptionResult {
  key: string;
  label: string;
  count: number;
  pct: string;
}
export interface QuestionResult {
  questionId: number;
  type: QuestionType;
  prompt: string;
  answered: number;
  options: OptionResult[];
  average: string | null;
  /** NUMBER questions: the smallest and largest answer. */
  min: number | null;
  max: number | null;
  distribution: Record<string, number>;
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  samples: string[];
  hidden: boolean;
}
export interface SurveyResults {
  surveyId: number;
  status: SurveyStatus;
  responses: number;
  recipients: number;
  isAnonymous: boolean;
  questions: QuestionResult[];
}

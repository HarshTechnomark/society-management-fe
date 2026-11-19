/** Module 16 resident app types: notice board, surveys, inbox, preferences, push (spec 8.18 to 8.24, 8.34). */
export interface NoticeAction {
  type: string;
  label: string;
  /** OPEN, PAID or CLOSED (spec 8.19). */
  state: 'OPEN' | 'PAID' | 'CLOSED';
  refId: number | null;
  url: string | null;
  amountPaise: number | null;
  receiptNo: string | null;
}
export interface NoticeItem {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  priority: 'NORMAL' | 'HIGH';
  kind: string;
  status: string;
  isPinned: boolean;
  requiresAck: boolean;
  acknowledgedAt: string | null;
  readAt: string | null;
  publishedAt: string | null;
  actions: NoticeAction[];
  attachmentCount: number;
}
export interface NoticeAttachment {
  fileId: number;
  name: string;
  sizeBytes: number;
}
export interface NoticeUtility {
  type: string;
  startsAt: string | null;
  endsAt: string | null;
  restoredAt: string | null;
}
export interface NoticeDetail extends NoticeItem {
  /** Sanitised HTML from the server (BR-16-2); render through `safeHtml`. */
  body: string;
  locale: string;
  attachments: NoticeAttachment[];
  utility: NoticeUtility | null;
  revisionNo: number;
}
export interface NoticeQuery {
  category?: string;
  unread?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}
export interface NoticePage {
  items: NoticeItem[];
  total: number;
  pages: number;
}
export interface AckResult {
  noticeId: number;
  acknowledgedAt: string;
  revisionNo: number;
}

export type SurveyQuestionType =
  'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'YES_NO' | 'RATING' | 'NPS' | 'NUMBER' | 'TEXT' | 'DATE';
export interface SurveyQuestion {
  id: number;
  type: SurveyQuestionType;
  prompt: string;
  helpText: string | null;
  isRequired: boolean;
  options: { key: string; label: string }[];
  maxSelections: number | null;
  minValue: number | null;
  maxValue: number | null;
  maxLength: number | null;
}
export interface SurveyListItem {
  id: number;
  title: string;
  status: string;
  closesAt: string | null;
  questionCount: number;
  responded: boolean;
  resultsAvailable: boolean;
}
export interface SurveyResultQuestion {
  questionId: number;
  type: string;
  prompt: string;
  answered: number;
  options: { key: string; label: string; count: number; pct: string }[];
  average: string | null;
  distribution: Record<string, number> | null;
  nps: number | null;
  samples: string[];
  hidden: boolean;
}
export interface SurveyResults {
  responses: number;
  recipients: number;
  questions: SurveyResultQuestion[];
}
export interface SurveyDetail {
  id: number;
  title: string;
  description: string;
  status: string;
  isAnonymous: boolean;
  responseScope: 'PERSON' | 'FLAT';
  closesAt: string | null;
  responded: boolean;
  questions: SurveyQuestion[];
  /** Only when results are visible (CLOSED and `resultsVisibility` allows). */
  results: SurveyResults | null;
  /** The caller's matching flats, when the API sends them (FLAT scope). */
  units: { unitId: number; label: string; responded?: boolean }[];
}
export interface SurveyAnswer {
  questionId: number;
  optionKey?: string;
  optionKeys?: string[];
  number?: number;
  text?: string;
  date?: string;
}
export interface SurveySubmitResult {
  submissionId: string;
  submittedAt: string;
}

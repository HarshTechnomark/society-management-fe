/** Response mapping for the module 16 resident calls (tolerant of missing fields). */
import type {
  InboxItem,
  InboxPage,
  NoticeAction,
  NoticeDetail,
  NoticeItem,
  NoticePage,
  Preferences,
  PrefCategory,
  PrefChannel,
  PushSubscriptionRow,
  SurveyDetail,
  SurveyListItem,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyResults,
} from '@/types/residentNotices';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : arr(obj(v).items));

function mapAction(raw: unknown): NoticeAction {
  const r = obj(raw);
  const s = str(r.state, 'OPEN').toUpperCase();
  return {
    type: str(r.type),
    label: str(r.label),
    state: s === 'PAID' || s === 'CLOSED' ? s : 'OPEN',
    refId: numOrNull(r.refId),
    url: strOrNull(r.url),
    amountPaise: numOrNull(r.amountPaise),
    receiptNo: strOrNull(r.receiptNo),
  };
}

export function mapNotice(raw: unknown): NoticeItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    title: str(r.title),
    excerpt: str(r.excerpt),
    category: str(r.category, 'GENERAL'),
    priority: r.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
    kind: str(r.kind, 'STANDARD'),
    status: str(r.status, 'PUBLISHED'),
    isPinned: r.isPinned === true,
    requiresAck: r.requiresAck === true,
    acknowledgedAt: strOrNull(r.acknowledgedAt),
    readAt: strOrNull(r.readAt),
    publishedAt: strOrNull(r.publishedAt),
    actions: arr(r.actions).map(mapAction),
    attachmentCount: num(r.attachmentCount, arr(r.attachments).length),
  };
}

export function mapNoticeDetail(raw: unknown): NoticeDetail {
  const r = obj(raw);
  const u = r.utility == null ? null : obj(r.utility);
  return {
    ...mapNotice(r),
    body: str(r.body),
    locale: str(r.locale, 'en-IN'),
    attachments: arr(r.attachments).map(a => ({
      fileId: num(obj(a).fileId ?? obj(a).id),
      name: str(obj(a).name, 'Attachment'),
      sizeBytes: num(obj(a).sizeBytes),
    })),
    utility: u && {
      type: str(u.type),
      startsAt: strOrNull(u.startsAt),
      endsAt: strOrNull(u.endsAt),
      restoredAt: strOrNull(u.restoredAt),
    },
    revisionNo: num(r.revisionNo, 1),
  };
}

export const mapNoticePage = (data: unknown, p?: { total?: number; totalPages?: number }): NoticePage => ({
  items: rows(data).map(mapNotice),
  total: num(p?.total, rows(data).length),
  pages: num(p?.totalPages, 1),
});

const QTYPES = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'YES_NO', 'RATING', 'NPS', 'NUMBER', 'TEXT', 'DATE'];
function mapQuestion(raw: unknown): SurveyQuestion {
  const r = obj(raw);
  return {
    id: num(r.id ?? r.questionId),
    type: (QTYPES.includes(str(r.type)) ? str(r.type) : 'TEXT') as SurveyQuestionType,
    prompt: str(r.prompt),
    helpText: strOrNull(r.helpText),
    isRequired: r.isRequired !== false,
    options: arr(r.options).map(o => ({ key: str(obj(o).key), label: str(obj(o).label) })),
    maxSelections: numOrNull(r.maxSelections),
    minValue: numOrNull(r.minValue),
    maxValue: numOrNull(r.maxValue),
    maxLength: numOrNull(r.maxLength),
  };
}

export const mapSurveyList = (raw: unknown): SurveyListItem[] =>
  rows(raw).map(x => {
    const r = obj(x);
    return {
      id: num(r.id),
      title: str(r.title),
      closesAt: strOrNull(r.closesAt),
      questionCount: num(r.questionCount),
      responded: r.responded === true,
      resultsAvailable: r.resultsAvailable === true,
    };
  });

function mapResults(raw: unknown): SurveyResults {
  const r = obj(raw);
  return {
    responses: num(r.responses),
    recipients: num(r.recipients),
    questions: arr(r.questions).map(q => {
      const x = obj(q);
      return {
        questionId: num(x.questionId),
        type: str(x.type),
        prompt: str(x.prompt),
        answered: num(x.answered),
        options: arr(x.options).map(o => ({
          key: str(obj(o).key),
          label: str(obj(o).label),
          count: num(obj(o).count),
          pct: str(obj(o).pct, '0.0'),
        })),
        average: strOrNull(x.average),
        distribution: x.distribution ? (obj(x.distribution) as Record<string, number>) : null,
        nps: numOrNull(x.nps),
        samples: arr(x.samples).map(s => str(s)),
        hidden: x.hidden === true,
      };
    }),
  };
}

export function mapSurveyDetail(raw: unknown): SurveyDetail {
  const r = obj(raw);
  return {
    id: num(r.id ?? r.surveyId),
    title: str(r.title),
    description: str(r.description),
    status: str(r.status, 'OPEN'),
    isAnonymous: r.isAnonymous === true,
    responseScope: r.responseScope === 'FLAT' ? 'FLAT' : 'PERSON',
    closesAt: strOrNull(r.closesAt),
    responded: r.responded === true,
    questions: arr(r.questions).map(mapQuestion),
    results: r.results ? mapResults(r.results) : null,
    units: arr(r.units).map(u => ({ unitId: num(obj(u).unitId ?? obj(u).id), label: str(obj(u).label) })),
  };
}

const TONES = ['info', 'ok', 'warn', 'bad'];
export function mapInboxItem(raw: unknown): InboxItem {
  const r = obj(raw);
  return {
    id: num(r.id),
    templateKey: str(r.templateKey),
    category: str(r.category, 'SYSTEM'),
    tone: (TONES.includes(str(r.tone)) ? str(r.tone) : 'info') as InboxItem['tone'],
    title: str(r.title),
    body: str(r.body),
    deepLink: strOrNull(r.deepLink),
    readAt: strOrNull(r.readAt),
    createdAt: str(r.createdAt),
  };
}
export const mapInboxPage = (env: Obj): InboxPage => {
  const p = obj(env.pagination);
  return {
    items: rows(env.data).map(mapInboxItem),
    total: num(p.total, rows(env.data).length),
    pages: num(p.totalPages, 1),
    unreadCount: num(env.unreadCount),
  };
};

const CH: PrefChannel[] = ['PUSH', 'SMS', 'WHATSAPP', 'EMAIL'];
function mapCategory(raw: unknown): PrefCategory {
  const r = obj(raw);
  const c = obj(r.channels);
  return {
    key: str(r.key),
    locked: r.locked === true,
    channels: Object.fromEntries(CH.map(k => [k, c[k] !== false])) as Record<PrefChannel, boolean>,
  };
}
export function mapPreferences(raw: unknown): Preferences {
  const r = obj(raw);
  const q = obj(r.quietHours);
  const w = obj(r.whatsapp);
  const e = obj(r.email);
  const mode = str(q.mode, 'SOCIETY_DEFAULT');
  return {
    locale: strOrNull(r.locale),
    effectiveLocale: str(r.effectiveLocale, 'en-IN'),
    categories: arr(r.categories).map(mapCategory),
    quietHours: {
      mode: (mode === 'CUSTOM' || mode === 'OFF'
        ? mode
        : 'SOCIETY_DEFAULT') as Preferences['quietHours']['mode'],
      start: str(q.start, '22:00'),
      end: str(q.end, '07:00'),
    },
    whatsapp: { optIn: w.optIn === true, optInAt: strOrNull(w.optInAt), available: w.available !== false },
    email: { address: str(e.address), bounced: e.bounced === true },
    version: num(r.version, 1),
  };
}
export const mapPushList = (raw: unknown): PushSubscriptionRow[] =>
  rows(raw).map(x => {
    const r = obj(x);
    return {
      id: num(r.id),
      app: str(r.app),
      deviceLabel: str(r.deviceLabel, 'This device'),
      status: str(r.status, 'ACTIVE'),
      createdAt: str(r.createdAt),
      lastSuccessAt: strOrNull(r.lastSuccessAt),
      isThisDevice: r.isThisDevice === true,
    };
  });

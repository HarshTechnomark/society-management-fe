import type {
  DeliveryPage,
  TemplateDetail,
  TemplatePage,
  TemplatePreview,
  TemplateRow,
} from '@/types/platformCommunication';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : arr(obj(v).items));
const strs = (v: unknown) => arr(v).map(x => str(x));

export function mapTemplateRow(raw: unknown): TemplateRow {
  const r = obj(raw);
  return {
    id: num(r.id),
    templateKey: str(r.templateKey),
    locale: str(r.locale, 'en-IN'),
    module: str(r.module),
    category: str(r.category),
    deliveryClass: str(r.deliveryClass),
    defaultChannels: strs(r.defaultChannels),
    smsDltTemplateId: strOrNull(r.smsDltTemplateId),
    whatsappTemplateName: strOrNull(r.whatsappTemplateName),
    whatsappStatus: strOrNull(r.whatsappStatus),
    isActive: r.isActive !== false,
    textEditedAt: strOrNull(r.textEditedAt),
    version: num(r.version, 1),
  };
}

export function mapTemplateDetail(raw: unknown): TemplateDetail {
  const r = obj(raw);
  const vs = obj(r.variablesSchema ?? r.variables);
  const variables = Array.isArray(r.variables)
    ? arr(r.variables).map(v => ({
        name: str(obj(v).name),
        type: str(obj(v).type, 'string'),
        required: obj(v).required !== false,
        maxLength: obj(v).maxLength == null ? null : num(obj(v).maxLength),
      }))
    : Object.entries(vs).map(([name, v]) => ({
        name,
        type: str(obj(v).type, 'string'),
        required: obj(v).required !== false,
        maxLength: obj(v).maxLength == null ? null : num(obj(v).maxLength),
      }));
  return {
    ...mapTemplateRow(r),
    allowedChannels: strs(r.allowedChannels),
    variables,
    inAppTitle: strOrNull(r.inAppTitle),
    inAppBody: strOrNull(r.inAppBody),
    pushTitle: strOrNull(r.pushTitle),
    pushBody: strOrNull(r.pushBody),
    smsBody: strOrNull(r.smsBody),
    smsDltCategory: strOrNull(r.smsDltCategory),
    whatsappCategory: strOrNull(r.whatsappCategory),
    whatsappParams: strs(r.whatsappParams),
    emailSubject: strOrNull(r.emailSubject),
    emailHtml: strOrNull(r.emailHtml),
    emailText: strOrNull(r.emailText),
  };
}

export const mapTemplatePage = (
  data: unknown,
  p?: { total?: number; totalPages?: number },
): TemplatePage => ({
  items: rows(data).map(mapTemplateRow),
  total: num(p?.total, rows(data).length),
  pages: num(p?.totalPages, 1),
});

export function mapPreview(raw: unknown): TemplatePreview {
  const r = obj(raw);
  const sms = r.sms == null ? null : obj(r.sms);
  const wa = r.whatsapp == null ? null : obj(r.whatsapp);
  const em = r.email == null ? null : obj(r.email);
  const text = (v: unknown) =>
    v == null ? null : typeof v === 'string' ? v : { title: str(obj(v).title), body: str(obj(v).body) };
  return {
    inApp: text(r.inApp),
    push: text(r.push),
    sms: sms && { text: str(sms.text), segments: num(sms.segments), encoding: str(sms.encoding) },
    whatsapp: wa && { name: str(wa.name), params: strs(wa.params) },
    email: em && { subject: str(em.subject), html: str(em.html), text: str(em.text) },
  };
}

export const mapDeliveryPage = (
  data: unknown,
  p?: { total?: number; totalPages?: number },
): DeliveryPage => ({
  items: rows(data).map(x => {
    const r = obj(x);
    return {
      id: num(r.id),
      societyId: r.societyId == null ? null : num(r.societyId),
      templateKey: str(r.templateKey),
      channel: str(r.channel),
      destinationMasked: str(r.destinationMasked),
      status: str(r.status),
      skipReason: strOrNull(r.skipReason),
      attempts: num(r.attempts),
      providerKey: strOrNull(r.providerKey),
      lastErrorCode: strOrNull(r.lastErrorCode),
      limitBypassed: r.limitBypassed === true,
      createdAt: str(r.createdAt),
      sentAt: strOrNull(r.sentAt),
      deliveredAt: strOrNull(r.deliveredAt),
    };
  }),
  total: num(p?.total, rows(data).length),
  pages: num(p?.totalPages, 1),
});

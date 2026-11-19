/** Module 16 platform console types: template registry and delivery log (spec 8.35, 8.36). */
export interface TemplateRow {
  id: number;
  templateKey: string;
  locale: string;
  module: string;
  category: string;
  deliveryClass: string;
  defaultChannels: string[];
  smsDltTemplateId: string | null;
  whatsappTemplateName: string | null;
  whatsappStatus: string | null;
  isActive: boolean;
  textEditedAt: string | null;
  version: number;
}
export interface TemplateDetail extends TemplateRow {
  allowedChannels: string[];
  variables: { name: string; type: string; required: boolean; maxLength: number | null }[];
  inAppTitle: string | null;
  inAppBody: string | null;
  pushTitle: string | null;
  pushBody: string | null;
  smsBody: string | null;
  smsDltCategory: string | null;
  whatsappCategory: string | null;
  whatsappParams: string[];
  emailSubject: string | null;
  emailHtml: string | null;
  emailText: string | null;
}
export interface TemplateQuery {
  module?: string;
  category?: string;
  deliveryClass?: string;
  locale?: string;
  q?: string;
  missing?: 'SMS_DLT' | 'WHATSAPP' | 'LOCALE';
  page?: number;
  limit?: number;
}
export interface TemplatePage {
  items: TemplateRow[];
  total: number;
  pages: number;
}
export type TemplatePatch = Partial<
  Pick<
    TemplateDetail,
    | 'inAppTitle'
    | 'inAppBody'
    | 'pushTitle'
    | 'pushBody'
    | 'smsBody'
    | 'emailSubject'
    | 'emailHtml'
    | 'emailText'
    | 'smsDltTemplateId'
    | 'smsDltCategory'
    | 'whatsappTemplateName'
    | 'whatsappCategory'
    | 'whatsappStatus'
    | 'whatsappParams'
    | 'isActive'
  >
> & { version: number };
export interface TemplatePreview {
  inApp: { title: string; body: string } | string | null;
  push: { title: string; body: string } | string | null;
  sms: { text: string; segments: number; encoding: string } | null;
  whatsapp: { name: string; params: string[] } | null;
  email: { subject: string; html: string; text: string } | null;
}
export interface DeliveryRow {
  id: number;
  societyId: number | null;
  templateKey: string;
  channel: string;
  destinationMasked: string;
  status: string;
  skipReason: string | null;
  attempts: number;
  providerKey: string | null;
  lastErrorCode: string | null;
  limitBypassed: boolean;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
}
export interface DeliveryQuery {
  societyId?: number;
  channel?: string;
  status?: string;
  templateKey?: string;
  recipient?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
export interface DeliveryPage {
  items: DeliveryRow[];
  total: number;
  pages: number;
}

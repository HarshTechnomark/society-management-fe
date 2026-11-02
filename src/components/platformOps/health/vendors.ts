import type { ProviderChannel } from '@/types/platformOps';

export interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  options?: string[];
  optional?: boolean;
}
export interface VendorDef {
  vendor: string;
  channels: ProviderChannel[];
  label: string;
  config: Partial<Record<ProviderChannel, FieldDef[]>> & { default: FieldDef[] };
  credentials: Partial<Record<ProviderChannel, FieldDef[]>> & { default: FieldDef[] };
}

const dlt: FieldDef[] = [
  { key: 'senderId', label: 'Sender ID', hint: 'Six capital letters, for example SOCAPP' },
  { key: 'dltEntityId', label: 'DLT entity ID', hint: '12 to 20 digits' },
  { key: 'testTemplateId', label: 'Test template ID', hint: '12 to 20 digits' },
];

/** Vendor config and credential fields (spec 7.4). Credentials are always sent complete. */
export const VENDORS: VendorDef[] = [
  {
    vendor: 'MSG91',
    label: 'MSG91',
    channels: ['SMS'],
    config: { default: dlt },
    credentials: { default: [{ key: 'authKey', label: 'Auth key' }] },
  },
  {
    vendor: 'GUPSHUP',
    label: 'Gupshup',
    channels: ['SMS', 'WHATSAPP'],
    config: {
      default: dlt,
      WHATSAPP: [
        { key: 'sourceNumber', label: 'Source number', hint: '91 followed by 10 digits' },
        { key: 'appName', label: 'App name' },
      ],
    },
    credentials: {
      default: [
        { key: 'userId', label: 'User ID' },
        { key: 'password', label: 'Password' },
      ],
      WHATSAPP: [{ key: 'apiKey', label: 'API key' }],
    },
  },
  {
    vendor: 'KALEYRA',
    label: 'Kaleyra',
    channels: ['SMS'],
    config: { default: [{ key: 'sid', label: 'SID' }, ...dlt] },
    credentials: { default: [{ key: 'apiKey', label: 'API key' }] },
  },
  {
    vendor: 'META_CLOUD',
    label: 'Meta WhatsApp Cloud',
    channels: ['WHATSAPP'],
    config: {
      default: [
        { key: 'phoneNumberId', label: 'Phone number ID' },
        { key: 'wabaId', label: 'WhatsApp business account ID' },
        { key: 'apiVersion', label: 'API version', hint: 'For example v20.0' },
        { key: 'testTemplate', label: 'Test template name' },
      ],
    },
    credentials: {
      default: [
        { key: 'accessToken', label: 'Access token' },
        { key: 'appSecret', label: 'App secret' },
      ],
    },
  },
  {
    vendor: 'AWS_SES',
    label: 'Amazon SES',
    channels: ['EMAIL'],
    config: {
      default: [
        { key: 'region', label: 'Region', options: ['ap-south-1', 'ap-south-2'] },
        { key: 'fromEmail', label: 'From email' },
        { key: 'fromName', label: 'From name' },
        { key: 'configurationSet', label: 'Configuration set', optional: true },
      ],
    },
    credentials: {
      default: [
        { key: 'accessKeyId', label: 'Access key ID' },
        { key: 'secretAccessKey', label: 'Secret access key' },
      ],
    },
  },
  {
    vendor: 'SENDGRID',
    label: 'SendGrid',
    channels: ['EMAIL'],
    config: {
      default: [
        { key: 'fromEmail', label: 'From email' },
        { key: 'fromName', label: 'From name' },
      ],
    },
    credentials: { default: [{ key: 'apiKey', label: 'API key' }] },
  },
  {
    vendor: 'WEB_PUSH_VAPID',
    label: 'Web push (VAPID)',
    channels: ['PUSH'],
    config: { default: [{ key: 'subject', label: 'Subject', hint: 'mailto:you@example.com' }] },
    credentials: {
      default: [
        { key: 'publicKey', label: 'Public key' },
        { key: 'privateKey', label: 'Private key' },
      ],
    },
  },
  {
    vendor: 'RAZORPAY',
    label: 'Razorpay',
    channels: ['PAYMENT_GATEWAY'],
    config: { default: [{ key: 'mode', label: 'Mode', options: ['test', 'live'] }] },
    credentials: {
      default: [
        { key: 'keyId', label: 'Key ID' },
        { key: 'keySecret', label: 'Key secret' },
        { key: 'webhookSecret', label: 'Webhook secret' },
      ],
    },
  },
  {
    vendor: 'CASHFREE',
    label: 'Cashfree',
    channels: ['PAYMENT_GATEWAY'],
    config: { default: [{ key: 'mode', label: 'Mode', options: ['sandbox', 'production'] }] },
    credentials: {
      default: [
        { key: 'appId', label: 'App ID' },
        { key: 'secretKey', label: 'Secret key' },
      ],
    },
  },
  {
    vendor: 'S3_COMPATIBLE',
    label: 'S3 compatible storage',
    channels: ['STORAGE'],
    config: { default: [] },
    credentials: { default: [] },
  },
  {
    vendor: 'EXOTEL',
    label: 'Exotel',
    channels: ['IVR'],
    config: {
      default: [
        { key: 'sid', label: 'SID' },
        { key: 'subdomain', label: 'Subdomain', options: ['api.exotel.com', 'api.in.exotel.com'] },
        { key: 'callerId', label: 'Caller ID', hint: '0 followed by 10 digits' },
      ],
    },
    credentials: {
      default: [
        { key: 'apiKey', label: 'API key' },
        { key: 'apiToken', label: 'API token' },
      ],
    },
  },
  {
    vendor: 'FAKE',
    label: 'Fake (testing only)',
    channels: ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH', 'PAYMENT_GATEWAY', 'STORAGE', 'IVR'],
    config: { default: [{ key: 'failMode', label: 'Fail mode', options: ['none', 'error', 'slow'] }] },
    credentials: { default: [] },
  },
];

export const vendorsFor = (channel: ProviderChannel) => VENDORS.filter(v => v.channels.includes(channel));
export const configFields = (vendor: string, channel: ProviderChannel): FieldDef[] => {
  const v = VENDORS.find(x => x.vendor === vendor);
  return v ? (v.config[channel] ?? v.config.default) : [];
};
export const credentialFields = (vendor: string, channel: ProviderChannel): FieldDef[] => {
  const v = VENDORS.find(x => x.vendor === vendor);
  return v ? (v.credentials[channel] ?? v.credentials.default) : [];
};

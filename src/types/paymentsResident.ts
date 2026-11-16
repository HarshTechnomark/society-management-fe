/** Module 12 resident payment shapes (spec 8.2 to 8.9 and 8.24), as the screens use them. */

export type PayableType = 'INVOICE' | 'COLLECTION_REQUEST';
export type FeeMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET';
export type FeeMode = 'PASS_TO_PAYER' | 'SOCIETY_ABSORBS' | string;

export interface Payable {
  type: PayableType;
  id: number;
  label: string;
  dueDate: string | null;
  /** Invoices: what is still owed. Collection requests: null. */
  outstandingPaise: number | null;
  /** Collection requests: the amount the society suggests. */
  suggestedPaise: number | null;
  isOverdue: boolean;
  isDisputed: boolean;
  minPaise: number;
  maxPaise: number;
  paidPaise: number;
}

export interface LiveOrder {
  orderId: number;
  status: string;
}

export interface Payables {
  unit: { id: number; label: string };
  items: Payable[];
  totalDuesPaise: number;
  advanceBalancePaise: number;
  payListVersion: string;
  allowPartial: boolean;
  allowAdvance: boolean;
  fee: { mode: FeeMode; methods: Record<string, number> };
  gatewayReady: boolean;
  offlineInstructions: string | null;
  liveOrder: LiveOrder | null;
}

export interface OrderItemInput {
  type: PayableType;
  id: number;
  amountPaise: number;
}

export interface CreateOrderInput {
  unitId: number;
  allocationMode: 'OLDEST_FIRST' | 'SELECTED';
  duesAmountPaise?: number;
  items?: OrderItemInput[];
  advancePaise?: number;
  methodHint?: FeeMethod;
  payListVersion: string;
  device?: 'PHONE' | 'DESKTOP';
}

export interface OrderLine {
  label: string;
  amountPaise: number;
}

/** The gateway block of an order. Real gateways fill the URLs; the fake one only a gateway order id. */
export interface Checkout {
  provider: string;
  gatewayOrderId: string;
  keyId: string | null;
  name: string;
  description: string;
  methods: string[];
  upiIntentUrl: string | null;
  qrPayload: string | null;
  redirectUrl: string | null;
  /** True for the development fake gateway (no key, no UPI link, no redirect). */
  isFake: boolean;
  raw: Record<string, unknown>;
}

export interface OrderCreated {
  orderId: number;
  status: string;
  basePaise: number;
  convenienceFeePaise: number;
  convenienceFeeGstPaise: number;
  grossAmountPaise: number;
  expiresAt: string | null;
  lines: OrderLine[];
  checkout: Checkout;
}

export type OrderStatus = 'CREATED' | 'ATTEMPTED' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | string;

export interface OrderState {
  orderId: number;
  status: OrderStatus;
  payment: { id: number; receiptNo: string | null; amountPaise: number; paymentDate: string } | null;
  message: string | null;
  expiresAt: string | null;
  lines: OrderLine[];
  grossAmountPaise: number | null;
  /** Why the last attempt failed, when the server says so (`failureReason`). */
  failureReason: string | null;
  /** True when the server reports that the last bank attempt of this live order failed. */
  attemptFailed: boolean;
}

export interface DevPayResult {
  gatewayPaymentId: string;
  status: string;
}

export interface ResidentPayment {
  id: number;
  unitId: number;
  unitLabel: string;
  method: string;
  status: string;
  amountPaise: number;
  convenienceFeePaise: number;
  grossAmountPaise: number;
  toInvoicesPaise: number;
  toCollectionsPaise: number;
  toAdvancePaise: number;
  paymentDate: string;
  receiptNo: string | null;
  receiptStatus: string | null;
}

export interface PaymentPage {
  items: ResidentPayment[];
  page: number;
  totalPages: number;
}

export interface ReceiptUrl {
  url: string;
  expiresAt: string | null;
}

export interface DeclareInput {
  unitId: number;
  method: 'NEFT' | 'IMPS' | 'RTGS' | 'UPI_TO_BANK';
  amountPaise: number;
  paymentDate: string;
  referenceNo: string;
  fileIds: number[];
  note?: string;
}

export interface AdvanceEntry {
  id: number;
  entryType: string;
  amountPaise: number;
  balanceAfterPaise: number;
  narration: string;
  createdAt: string;
}

export interface Advances {
  unitId: number;
  balancePaise: number;
  entries: AdvanceEntry[];
}

export type MandateStatus =
  'PENDING_AUTH' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'FAILED' | string;

export interface Mandate {
  id: number;
  unitId: number;
  unitLabel: string;
  mandateType: 'UPI_AUTOPAY' | 'ENACH' | string;
  status: MandateStatus;
  maxAmountPaise: number;
  startDate: string;
  endDate: string;
  debitDaysBeforeDue: number | null;
  version: number;
}

export interface CreateMandateInput {
  unitId: number;
  mandateType: 'UPI_AUTOPAY' | 'ENACH';
  maxAmountPaise: number;
  startDate: string;
  endDate: string;
  debitDaysBeforeDue?: number;
}

export interface MandateCreated {
  mandateId: number;
  status: string;
  upiIntentUrl: string | null;
  redirectUrl: string | null;
  qrPayload: string | null;
  expiresAt: string | null;
}

export interface MyRequest {
  id: number;
  unitId: number;
  unitLabel: string;
  status: string;
  amountPaise: number;
  paidPaise: number;
}

export interface Collection {
  id: number;
  title: string;
  kind: string;
  purpose: string;
  isMandatory: boolean;
  amountMode: string;
  amountPerUnitPaise: number | null;
  minAmountPaise: number | null;
  dueDate: string | null;
  status: string;
  targetPaise: number;
  collectedPaise: number;
  percent: number;
  contributorCount: number | null;
  requestCount: number | null;
  myRequests: MyRequest[];
}

export interface CollectionDetail extends Collection {
  /** Null when the society hides the list. */
  whoPaid: { unitLabel: string; paidPaise: number | null }[] | null;
  spentPaise: number | null;
  expenses: { title: string; category: string; date: string; amountPaise: number }[];
}

export type PublicLinkStatus = 'PAYABLE' | 'PAID' | 'EXPIRED' | 'CANCELLED';

export interface PublicLink {
  societyName: string;
  unitLabel: string;
  payerNameMasked: string;
  amountPaise: number;
  status: PublicLinkStatus;
  expiresAt: string | null;
}

/** Normalisers from the settlement shapes (spec 7.9, 8.15) to `types/accountsSettlements.ts`. Never throw. */
import type {
  ImportSettlementResult,
  Settlement,
  SettlementItem,
  SettlementStatus,
} from '@/types/accountsSettlements';
import { arr, num, numN, obj, str, strN } from './accountsReadHelpers';

export function normaliseSettlementItem(raw: unknown): SettlementItem {
  const r = obj(raw);
  const pay = obj(r.payment);
  return {
    type: r.type === 'refund' ? 'refund' : 'payment',
    gatewayPaymentId: str(r.gatewayPaymentId),
    gatewayRefundId: strN(r.gatewayRefundId),
    amountPaise: num(r.amountPaise),
    feePaise: num(r.feePaise),
    taxPaise: num(r.taxPaise),
    matchedPaymentId: numN(r.matchedPaymentId) ?? numN(pay.id),
    receiptNo: strN(r.receiptNo) ?? strN(pay.receiptNo),
    reason: strN(r.reason),
  };
}

export function normaliseSettlement(raw: unknown): Settlement {
  const r = obj(raw);
  return {
    id: num(r.id),
    gatewayProvider: str(r.gatewayProvider),
    gatewaySettlementId: str(r.gatewaySettlementId),
    settlementDate: str(r.settlementDate),
    utr: strN(r.utr),
    grossPaise: num(r.grossPaise),
    refundsPaise: num(r.refundsPaise),
    feePaise: num(r.feePaise),
    feeGstPaise: num(r.feeGstPaise),
    adjustmentPaise: num(r.adjustmentPaise),
    netPaise: num(r.netPaise),
    paymentCount: num(r.paymentCount),
    status: str(r.status, 'RECEIVED') as SettlementStatus,
    differenceAcceptedReason: strN(r.differenceAcceptedReason),
    journalEntryId: numN(r.journalEntryId),
    postedAt: strN(r.postedAt),
    attempts: num(r.attempts),
    version: num(r.version, 1),
    items: arr(r.items).map(normaliseSettlementItem),
    unmatchedItems: arr(r.unmatchedItems).map(normaliseSettlementItem),
  };
}

export function normaliseImportResult(raw: unknown): ImportSettlementResult {
  const r = obj(raw);
  const errs = arr(r.errors).map(e => (typeof e === 'string' ? e : str(obj(e).message, str(obj(e).error))));
  return { created: num(r.created), skipped: num(r.skipped), errors: errs.filter(Boolean) };
}

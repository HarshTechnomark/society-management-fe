import type { PermissionKey } from '@/constants/permissions';

/** Links into the approvals screens (module 14): the detail when the request id is known, else the inbox filtered by type. */
export function approvalHref(requestId?: number | null, type?: string): string {
  if (requestId) return `/admin/approvals/${requestId}`;
  return type ? `/admin/approvals?type=${encodeURIComponent(type)}` : '/admin/approvals';
}

/**
 * "Any type request permission" of the backend (`/approvals/submitted`): makers holding one of these reach "Submitted by me"
 * even without the inbox permission.
 */
export const APPROVAL_REQUEST_KEYS = [
  'finance.expenses.create',
  'finance.payments.create',
  'finance.billing.create',
  'finance.billing.edit',
  'finance.collections.create',
  'finance.accounts.create',
  'residents.requests.create',
  'vendors.purchase_orders.create',
  'communication.notices.create',
  'amenities.bookings.create',
  'settings.subscription.edit',
  'settings.integrations.edit',
  'documents.rules.edit',
  'documents.certificates.create',
  'documents.registers.edit',
  'automation.rules.edit',
  'governance.meetings.create',
] as const satisfies readonly PermissionKey[];

import { describe, expect, it } from 'vitest';
import { approvalHref } from './links';

describe('approvalHref', () => {
  it('opens the detail when the request id is known', () => {
    expect(approvalHref(42)).toBe('/admin/approvals/42');
    expect(approvalHref(42, 'EXPENSE')).toBe('/admin/approvals/42');
  });
  it('falls back to the inbox filtered by type, or the plain inbox', () => {
    expect(approvalHref(null, 'BILLING_RUN_PUBLISH')).toBe('/admin/approvals?type=BILLING_RUN_PUBLISH');
    expect(approvalHref(undefined)).toBe('/admin/approvals');
  });
});

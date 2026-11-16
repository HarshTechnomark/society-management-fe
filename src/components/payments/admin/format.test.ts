import { describe, expect, it } from 'vitest';
import { statusInfo } from './format';

describe('statusInfo', () => {
  it('shows Refunded and Part refunded from the refunded amount', () => {
    expect(statusInfo('CAPTURED', 0, 1000).label).toBe('Received');
    expect(statusInfo('CAPTURED', 400, 1000).label).toBe('Part refunded');
    expect(statusInfo('CONFIRMED', 1000, 1000).label).toBe('Refunded');
    expect(statusInfo('BOUNCED', 1000, 1000).label).toBe('Bounced');
  });
});

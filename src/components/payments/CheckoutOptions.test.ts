import { describe, expect, it } from 'vitest';
import { clockText } from './CheckoutOptions';

describe('clockText', () => {
  it('shows mm:ss under an hour, hours and minutes under two days, then days and hours', () => {
    expect(clockText(545)).toBe('9:05');
    expect(clockText(2879 * 60 + 57)).toBe('47 hours 59 minutes');
    expect(clockText(10079 * 60 + 33)).toBe('6 days 23 hours');
    expect(clockText(3600)).toBe('1 hour 0 minutes');
  });
});

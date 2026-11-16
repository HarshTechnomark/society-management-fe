import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StepUpDialog } from '@/components/common/StepUpDialog';
import { mockApi, navigationMock, resetAll } from '@/test/helpers';

vi.mock('next/navigation', () => navigationMock());
beforeEach(resetAll);

describe('StepUpDialog while closed', () => {
  it('does not call /auth/me (public pages such as /pay/[code] have no session)', () => {
    const api = mockApi({});
    render(<StepUpDialog open={false} onSuccess={() => {}} onCancel={() => {}} />);
    expect(api.fn.mock.calls.filter(c => String(c[0]).includes('/auth/me'))).toHaveLength(0);
  });
});

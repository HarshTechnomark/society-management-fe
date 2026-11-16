import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, ok, resetAll } from '@/test/helpers';
import { subscriptionsService } from './subscriptions.service';

beforeEach(resetAll);

describe('flag overrides', () => {
  it('reads the society of an override from society: { id, name }', async () => {
    mockApi({
      'GET /platform/feature-flags/1': ok({
        id: 1,
        overrides: [{ id: 70, society: { id: 5, name: 'Lake View' }, value: false }],
      }),
    });
    const d = await subscriptionsService.flag(1);
    expect(d.overrides[0]).toMatchObject({ societyId: 5, societyName: 'Lake View' });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/Toast';
import { setMe } from '@/lib/auth';
import { err, mockApi, ok, resetAll, sampleMe } from '@/test/helpers';
import { plan, starterPlan } from '@/test/subscriptionFixtures';
import { AddSocietyWizard } from './AddSocietyWizard';

const created = {
  id: 215,
  name: 'Lotus Residency CHS',
  slug: 'lotus-residency-chs',
  status: 'TRIAL',
  trialEndsAt: '2026-11-13T06:30:00.000Z',
  planKey: 'STANDARD',
  invitationId: 8812,
  version: 1,
};

function setup(perms = ['platform.societies.create'], routes = {}) {
  setMe(sampleMe({ platformPermissions: perms }));
  const api = mockApi({
    'GET /platform/plans': ok([starterPlan, plan()]),
    'GET /platform/societies/slug-availability': ok({
      slug: 'lotus-residency-chs',
      available: true,
      reason: null,
      suggestions: [],
    }),
    'POST /platform/societies': ok(created, 'Society created. Invite sent to the chairman.'),
    ...routes,
  });
  const onCreated = vi.fn();
  render(
    <ToastProvider>
      <AddSocietyWizard open onClose={vi.fn()} onCreated={onCreated} />
    </ToastProvider>,
  );
  return { api, onCreated };
}

async function fillStep1() {
  await userEvent.type(screen.getByLabelText(/^Society name/), 'Lotus Residency CHS');
  await userEvent.type(screen.getByLabelText(/^Address line 1/), 'Plot 4, Baner Road');
  await userEvent.type(screen.getByLabelText(/^City/), 'Pune');
  await userEvent.type(screen.getByLabelText(/^Pincode/), '411045');
  await userEvent.type(screen.getByLabelText(/^Approximate number of flats/), '120');
}
async function fillStep2() {
  await userEvent.type(screen.getByLabelText(/^Admin name/), 'Meera Iyer');
  await userEvent.type(screen.getByLabelText(/^Admin email/), 'meera@lotus.in');
  await userEvent.type(screen.getByLabelText(/^Admin mobile/), '9820011111');
}
const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('AddSocietyWizard (P-02)', () => {
  beforeEach(resetAll);

  it('validates each step with the prototype messages', async () => {
    setup();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Approximate number of flats/), '9');
    await next();
    expect(screen.getByText('Enter at least 10 flats.')).toBeInTheDocument();
    expect(screen.getByText('Enter the society name.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^Approximate number of flats/));
    await fillStep1();
    await next();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(
      screen.getByText(
        'An invite goes to this admin. They sign in with a mobile OTP and complete the 8-step onboarding wizard.',
      ),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Admin mobile/), '12345');
    await next();
    expect(screen.getByText('Enter a 10 digit Indian mobile number.')).toBeInTheDocument();
  });

  it('checks the slug live and creates a trial society with the full 8.4 body', async () => {
    const { api, onCreated } = setup();
    await fillStep1();
    expect(await screen.findByText('lotus-residency-chs.societyapp.in is available.')).toBeInTheDocument();
    await next();
    await fillStep2();
    await userEvent.selectOptions(screen.getByLabelText(/^Role/), 'society_admin');
    await next();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    // No approve permission: only the free trial can be chosen.
    expect(screen.queryByRole('option', { name: 'Paid subscription now' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Estimated ₹1,800 per month for 120 billable flats \(minimum 50\) after the trial/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create society' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 215 })));
    const body = api.last('POST', '/platform/societies')!.body;
    expect(body).toEqual({
      society: {
        name: 'Lotus Residency CHS',
        slug: 'lotus-residency-chs',
        addressLine1: 'Plot 4, Baner Road',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411045',
        approxFlats: 120,
      },
      firstAdmin: {
        name: 'Meera Iyer',
        mobile: '9820011111',
        email: 'meera@lotus.in',
        roleKey: 'society_admin',
      },
      plan: { planKey: 'STANDARD', billingCycle: 'MONTHLY', startAs: 'TRIAL' },
    });
    const headers = api.fn.mock.calls.find(c => (c[1] as RequestInit)?.method === 'POST')![1] as RequestInit;
    expect((headers.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  });

  it('offers paid start only with approve permission', async () => {
    setup(['platform.societies.create', 'platform.societies.approve']);
    await fillStep1();
    await next();
    await fillStep2();
    await next();
    expect(screen.getByRole('option', { name: 'Paid subscription now' })).toBeInTheDocument();
  });

  it('jumps back to step 1 with suggestions on SLUG_TAKEN', async () => {
    const { api } = setup(undefined, {
      'POST /platform/societies': [
        {
          status: 409,
          code: 'SLUG_TAKEN',
          message: 'Slug taken',
          errors: [
            {
              field: 'society.slug',
              message: 'taken',
              suggestions: ['lotus-residency-pune', 'lotus-residency-2'],
            } as never,
          ],
        },
        ok(created),
      ],
    });
    await fillStep1();
    await next();
    await fillStep2();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Create society' }));
    expect(await screen.findByText('This web address is already in use.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'lotus-residency-pune' }));
    await next();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Create society' }));
    await waitFor(() =>
      expect(
        (api.last('POST', '/platform/societies')!.body as { society: { slug: string } }).society.slug,
      ).toBe('lotus-residency-pune'),
    );
  });

  it('asks to confirm a possible duplicate and resends with confirmNotDuplicate', async () => {
    const { api, onCreated } = setup(undefined, {
      'POST /platform/societies': [
        {
          status: 409,
          code: 'POSSIBLE_DUPLICATE_SOCIETY',
          message: 'dup',
          errors: [
            { field: 'society', message: 'match', name: 'Green Park CHS', city: 'Thane', id: 9 } as never,
          ],
        },
        ok(created),
      ],
    });
    await fillStep1();
    await next();
    await fillStep2();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Create society' }));
    expect(await screen.findByText(/Green Park CHS, Thane \(#9\)/)).toBeInTheDocument();
    await next();
    expect(screen.getByText('Confirm that this is a different society, or cancel.')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('This is a different society. Create it anyway.'));
    await next();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Create society' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(api.last('POST', '/platform/societies')!.body).toMatchObject({ confirmNotDuplicate: true });
  });

  it('shows a permission error for a paid start without approve', async () => {
    setup(['platform.societies.create'], {
      'POST /platform/societies': err(403, 'PERMISSION_DENIED'),
    });
    await fillStep1();
    await next();
    await fillStep2();
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Create society' }));
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
  });
});

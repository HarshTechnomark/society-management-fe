import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flow } from '@/lib/authFlow';
import { err, futureIso, mockApi, navigationMock, ok, resetAll, router, sampleMe } from '@/test/helpers';
import { SignupDetailsScreen } from '@/components/auth/SignupDetailsScreen';
import { SupportHandoffScreen } from './SupportHandoffScreen';

vi.mock('next/navigation', () => navigationMock());

const signup = { signupToken: 'sgt_abc', mobile: '9820011111', expiresAt: futureIso(900) };

async function fillYou() {
  await userEvent.type(screen.getByLabelText(/^Your name/), 'Aarav Mehta');
  await userEvent.type(screen.getByLabelText(/^Email/), 'Aarav@GreenPark.in');
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
}
async function fillSociety() {
  await userEvent.type(screen.getByLabelText(/^Society name/), 'Green Park CHS');
  await userEvent.type(screen.getByLabelText(/^Address line 1/), '12 Ghodbunder Road');
  await userEvent.type(screen.getByLabelText(/^City/), 'Thane');
  await userEvent.type(screen.getByLabelText(/^Pincode/), '400607');
  await userEvent.type(screen.getByLabelText(/^Approximate number of flats/), '120');
}

describe('Sign-up details (S-01 steps 2 and 3)', () => {
  beforeEach(resetAll);

  it('sends the visitor back to /signup without a verified mobile', async () => {
    render(<SignupDetailsScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/signup'));
  });

  it('validates, then creates the trial society and opens onboarding (US-05-02)', async () => {
    flow.set({ signup });
    const api = mockApi({
      'POST /public/signups': ok({
        societyId: 214,
        slug: 'green-park',
        status: 'TRIAL',
        trialEndsAt: '2026-11-13T06:30:00.000Z',
        role: 'chairman',
        redirectUrl: 'https://admin.societyapp.in/onboarding',
      }),
    });
    render(<SignupDetailsScreen />);
    expect(await screen.findByText('98XXXXX111 is verified. Tell us who you are.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText("Enter your name (letters, spaces, . ' -).")).toBeInTheDocument();
    await fillYou();
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    await fillSociety();
    await userEvent.click(screen.getByRole('button', { name: 'Create my society' }));
    expect(screen.getByText('Accept the terms to continue.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create my society' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
    expect(api.last('POST', '/public/signups')!.body).toEqual({
      signupToken: 'sgt_abc',
      person: { name: 'Aarav Mehta', email: 'aarav@greenpark.in', role: 'chairman' },
      society: {
        name: 'Green Park CHS',
        addressLine1: '12 Ghodbunder Road',
        city: 'Thane',
        state: 'Maharashtra',
        pincode: '400607',
        approxFlats: 120,
      },
      planKey: 'STANDARD',
      acceptTerms: true,
    });
    expect(flow.get().signup).toBeUndefined();
  });

  it('warns about a possible duplicate and resubmits with confirmNotDuplicate', async () => {
    flow.set({ signup });
    const api = mockApi({
      'POST /public/signups': [
        {
          status: 409,
          code: 'POSSIBLE_DUPLICATE_SOCIETY',
          message: 'dup',
          errors: [{ field: 'society', message: 'm', name: 'Green Park CHS', city: 'Thane' } as never],
        },
        ok({ societyId: 215, redirectUrl: 'https://admin.societyapp.in/onboarding' }),
      ],
    });
    render(<SignupDetailsScreen />);
    await fillYou();
    await fillSociety();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create my society' }));
    expect(
      await screen.findByText(
        /A society with a similar name already exists at this pincode: Green Park CHS, Thane\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ask my committee to invite me/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, create mine' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding'));
    expect(api.last('POST', '/public/signups')!.body).toMatchObject({ confirmNotDuplicate: true });
    expect(api.calls.filter(c => c.path === '/public/signups')).toHaveLength(2);
  });

  it('explains a used trial and an expired verification', async () => {
    flow.set({ signup });
    mockApi({
      'POST /public/signups': [err(409, 'TRIAL_ALREADY_USED'), err(401, 'SIGNUP_TOKEN_INVALID')],
    });
    render(<SignupDetailsScreen />);
    await fillYou();
    await fillSociety();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create my society' }));
    expect(await screen.findByText(/You already have a society on a free trial/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create my society' }));
    expect(await screen.findByText(/Your mobile verification has expired/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verify again' })).toHaveAttribute('href', '/signup');
  });
});

describe('Support hand-off page (P-09)', () => {
  beforeEach(resetAll);

  it('redeems the token from the fragment, removes it and opens Today', async () => {
    window.history.replaceState(null, '', '/support-handoff#token=tok_123');
    const api = mockApi({
      'POST /auth/support-handoff/redeem': ok(null),
      'GET /auth/me': ok(sampleMe({ supportGrant: { id: 43, scope: 'READ_ONLY', endsAt: futureIso(600) } })),
    });
    render(<SupportHandoffScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
    expect(api.last('POST', '/auth/support-handoff/redeem')!.body).toEqual({ token: 'tok_123' });
    expect(window.location.hash).toBe('');
  });

  it('explains an expired or used link', async () => {
    window.history.replaceState(null, '', '/support-handoff#token=old');
    mockApi({ 'POST /auth/support-handoff/redeem': err(401, 'HANDOFF_TOKEN_INVALID') });
    render(<SupportHandoffScreen />);
    expect(
      await screen.findByText(
        'This support link has expired or was already used. Start again from the platform console.',
      ),
    ).toBeInTheDocument();
  });

  it('fails cleanly without a token', async () => {
    window.history.replaceState(null, '', '/support-handoff');
    const api = mockApi({});
    render(<SupportHandoffScreen />);
    expect(await screen.findByText('Link expired')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });
});

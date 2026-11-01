'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cx } from '@/components/ui/cx';
import { AuthHeading, AuthShell, linkClass } from '@/components/auth/AuthShell';
import { ApiError } from '@/lib/apiClient';
import { flow } from '@/lib/authFlow';
import { useHydrated } from '@/lib/clientApp';
import { isValidEmail, maskMobile } from '@/lib/validation';
import { societiesService } from '@/services/societies.service';
import type { FirstAdminRole } from '@/types/societies';
import { INDIAN_STATES, isValidPincode, societyErrorText } from '../format';

type Plan = 'STARTER' | 'STANDARD' | 'PREMIUM';

interface Draft {
  name: string;
  email: string;
  role: FirstAdminRole;
  society: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  flats: string;
  plan: Plan;
  terms: boolean;
}

const EMPTY: Draft = {
  name: '',
  email: '',
  role: 'chairman',
  society: '',
  address1: '',
  address2: '',
  city: '',
  state: 'Maharashtra',
  pincode: '',
  flats: '',
  plan: 'STANDARD',
  terms: false,
};

type Errors = Partial<Record<keyof Draft, string>>;

const PLANS: [Plan, string, string][] = [
  ['STARTER', 'Starter', 'Billing, payments, helpdesk and notices'],
  ['STANDARD', 'Standard', 'Adds gate, amenities, parking, staff and community'],
  ['PREMIUM', 'Premium', 'Adds accounting, vendors, governance and AI'],
];

const FIELD: Record<string, keyof Draft> = {
  'person.name': 'name',
  'person.email': 'email',
  'person.role': 'role',
  'society.name': 'society',
  'society.addressLine1': 'address1',
  'society.addressLine2': 'address2',
  'society.city': 'city',
  'society.state': 'state',
  'society.pincode': 'pincode',
  'society.approxFlats': 'flats',
  planKey: 'plan',
  acceptTerms: 'terms',
};
const STEP_OF: Partial<Record<keyof Draft, 2 | 3>> = { name: 2, email: 2, role: 2 };

function check(step: 2 | 3, d: Draft): Errors {
  const e: Errors = {};
  if (step === 2) {
    if (!/^[\p{L} .'-]{2,120}$/u.test(d.name.trim())) e.name = "Enter your name (letters, spaces, . ' -).";
    if (d.email.trim() && !isValidEmail(d.email)) e.email = 'Enter a valid email or leave it empty.';
  } else {
    if (d.society.trim().length < 3) e.society = 'Enter your society name.';
    if (d.address1.trim().length < 5) e.address1 = 'Enter the address (at least 5 characters).';
    if (d.city.trim().length < 2) e.city = 'Enter the city.';
    if (!isValidPincode(d.pincode)) e.pincode = 'Enter a 6 digit pincode.';
    const flats = Number(d.flats);
    if (!Number.isInteger(flats) || flats < 10) e.flats = 'Enter at least 10 flats.';
    else if (flats > 20000) e.flats = 'Enter at most 20,000 flats.';
    if (!d.terms) e.terms = 'Accept the terms to continue.';
  }
  return e;
}

/**
 * S-01 sign-up, steps 2 and 3 (module 05). Step 1 (mobile and OTP) is module 02's `/signup`; the verified
 * `signupToken` waits in memory (`flow.signup`) and is sent once with `POST /public/signups`.
 */
export function SignupForm() {
  const hydrated = useHydrated();
  return hydrated ? (
    <Form />
  ) : (
    <AuthShell>
      <div className="min-h-[320px]" aria-busy="true" />
    </AuthShell>
  );
}

function Form() {
  const router = useRouter();
  const [signup] = useState(() => flow.get().signup);
  const [step, setStep] = useState<2 | 3>(2);
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<{ text: string; restart?: boolean } | null>(null);
  const [duplicates, setDuplicates] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signup) router.replace('/signup');
  }, [signup, router]);
  if (!signup) return null;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  const submit = async (confirmNotDuplicate = false) => {
    setBusy(true);
    setAlert(null);
    try {
      const r = await societiesService.signup({
        signupToken: signup.signupToken,
        person: { name: d.name.trim(), email: d.email.trim().toLowerCase() || undefined, role: d.role },
        society: {
          name: d.society.trim(),
          addressLine1: d.address1.trim(),
          addressLine2: d.address2.trim() || undefined,
          city: d.city.trim(),
          state: d.state,
          pincode: d.pincode.trim(),
          approxFlats: Number(d.flats),
        },
        planKey: d.plan,
        acceptTerms: true,
        confirmNotDuplicate: confirmNotDuplicate || undefined,
      });
      flow.clear('signup');
      let path = '/onboarding';
      try {
        path = new URL(r.redirectUrl, window.location.origin).pathname;
      } catch {
        /* keep the default */
      }
      router.replace(path);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'POSSIBLE_DUPLICATE_SOCIETY') {
        setDuplicates(
          (e.errors ?? []).map(x => {
            const m = x as unknown as { name?: string; city?: string };
            return [m.name, m.city].filter(Boolean).join(', ');
          }),
        );
      } else if (e instanceof ApiError && e.code === 'SIGNUP_TOKEN_INVALID') {
        setAlert({ text: societyErrorText(e), restart: true });
      } else if (e instanceof ApiError && e.code === 'VALIDATION_FAILED' && e.errors?.length) {
        const next: Errors = {};
        for (const f of e.errors) if (FIELD[f.field]) next[FIELD[f.field]] = f.message;
        setErrors(next);
        if (Object.keys(next).some(k => STEP_OF[k as keyof Draft] === 2)) setStep(2);
        setAlert({ text: e.message });
      } else {
        setAlert({ text: societyErrorText(e) });
      }
    } finally {
      setBusy(false);
    }
  };

  const next = (ev: FormEvent) => {
    ev.preventDefault();
    const e = check(step, d);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step === 2) setStep(3);
    else void submit();
  };

  if (duplicates)
    return (
      <AuthShell>
        <AuthHeading title="Is this a different society?" />
        <Alert tone="warn">
          A society with a similar name already exists at this pincode:{' '}
          {duplicates.filter(Boolean).join('; ') || 'one match'}. Is this a different society?
        </Alert>
        <div aria-live="assertive">{alert && <Alert tone="bad">{alert.text}</Alert>}</div>
        <Button block loading={busy} onClick={() => submit(true)}>
          Yes, create mine
        </Button>
        <p className="mt-4 text-center text-[14px] text-muted">
          Same society? Ask my committee to invite me. Your committee can add you from Settings › Team.
        </p>
        <p className="mt-2 text-center text-[14px]">
          <button type="button" className={linkClass} onClick={() => setDuplicates(null)}>
            Back to the details
          </button>
        </p>
      </AuthShell>
    );

  return (
    <AuthShell wide>
      <p className="mb-1 text-[13px] font-semibold text-muted">Step {step} of 3</p>
      <AuthHeading
        title={step === 2 ? 'About you' : 'Your society'}
        lead={
          step === 2
            ? `${maskMobile(signup.mobile)} is verified. Tell us who you are.`
            : 'Your society starts on a 14-day free trial. No card needed.'
        }
      />
      <div aria-live="assertive">
        {alert && (
          <Alert tone="bad">
            {alert.text}{' '}
            {alert.restart && (
              <Link href="/signup" className="underline">
                Verify again
              </Link>
            )}
          </Alert>
        )}
      </div>
      <form onSubmit={next} noValidate>
        {step === 2 ? (
          <>
            <Input
              label="Your name"
              autoComplete="name"
              value={d.name}
              onChange={e => set('name', e.target.value)}
              error={errors.name}
              required
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={d.email}
              onChange={e => set('email', e.target.value)}
              error={errors.email}
              hint="Optional. We send your welcome note and invoices here."
            />
            <fieldset className="mb-4">
              <legend className="mb-1.5 text-[13px] font-semibold">Your role</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['chairman', 'Chairman', 'Elected head of the committee'],
                    ['society_admin', 'Society Admin', 'Runs the society before or for the committee'],
                  ] as const
                ).map(([v, t, sub]) => (
                  <label
                    key={v}
                    className={cx(
                      'flex cursor-pointer flex-col gap-0.5 rounded-[16px] border-[1.5px] bg-white/70 p-3 text-[13px]',
                      d.role === v ? 'border-navy' : 'border-[rgba(20,35,44,0.16)]',
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={v}
                      checked={d.role === v}
                      onChange={() => set('role', v)}
                      className="sr-only"
                    />
                    <b className="text-[14px]">{t}</b>
                    <span className="text-muted">{sub}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" block>
              Next
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Society name"
              placeholder="e.g. Green Park CHS"
              value={d.society}
              onChange={e => set('society', e.target.value)}
              error={errors.society}
              required
            />
            <Input
              label="Address line 1"
              autoComplete="address-line1"
              value={d.address1}
              onChange={e => set('address1', e.target.value)}
              error={errors.address1}
              required
            />
            <Input
              label="Address line 2"
              autoComplete="address-line2"
              value={d.address2}
              onChange={e => set('address2', e.target.value)}
            />
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <Input
                label="City"
                autoComplete="address-level2"
                value={d.city}
                onChange={e => set('city', e.target.value)}
                error={errors.city}
                required
              />
              <Select
                label="State"
                value={d.state}
                onChange={e => set('state', e.target.value)}
                options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                required
              />
              <Input
                label="Pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={d.pincode}
                onChange={e => set('pincode', e.target.value.replace(/\D/g, ''))}
                error={errors.pincode}
                required
              />
              <Input
                label="Approximate number of flats"
                type="number"
                inputMode="numeric"
                min={10}
                max={20000}
                value={d.flats}
                onChange={e => set('flats', e.target.value)}
                error={errors.flats}
                required
              />
            </div>
            <fieldset className="mb-4">
              <legend className="mb-1.5 text-[13px] font-semibold">Plan for your trial</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PLANS.map(([v, t, sub]) => (
                  <label
                    key={v}
                    className={cx(
                      'flex cursor-pointer flex-col gap-0.5 rounded-[16px] border-[1.5px] bg-white/70 p-3 text-[13px]',
                      d.plan === v ? 'border-navy' : 'border-[rgba(20,35,44,0.16)]',
                    )}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={v}
                      checked={d.plan === v}
                      onChange={() => set('plan', v)}
                      className="sr-only"
                    />
                    <b className="text-[14px]">{t}</b>
                    <span className="text-muted">{sub}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Checkbox
              label={
                <>
                  I accept the{' '}
                  <a
                    href="https://societyapp.in/terms"
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    terms of service
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://societyapp.in/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    privacy policy
                  </a>
                  .
                </>
              }
              checked={d.terms}
              onChange={e => set('terms', e.target.checked)}
              error={errors.terms}
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="submit" block loading={busy}>
                Create my society
              </Button>
            </div>
          </>
        )}
      </form>
    </AuthShell>
  );
}

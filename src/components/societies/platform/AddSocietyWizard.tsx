'use client';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/components/ui/cx';
import { monthlyEquivalent, rupeesToPaise } from '@/components/subscription/format';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { ApiError } from '@/lib/apiClient';
import { inr } from '@/lib/money';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { societiesService } from '@/services/societies.service';
import { subscriptionsService } from '@/services/subscriptions.service';
import type { PlanSummary } from '@/types/subscriptions';
import type { CreatedSociety, FirstAdminRole, SlugAvailability, SocietyPlanKey } from '@/types/societies';
import { INDIAN_STATES, PLAN_LABEL, isValidPincode, isValidSlug, slugify, societyErrorText } from '../format';

interface Draft {
  name: string;
  city: string;
  state: string;
  flats: string;
  address1: string;
  address2: string;
  pincode: string;
  slug: string;
  slugEdited: boolean;
  legalName: string;
  registrationNo: string;
  gstin: string;
  organizationId: string;
  aname: string;
  aemail: string;
  amobile: string;
  role: FirstAdminRole;
  plan: SocietyPlanKey;
  start: 'TRIAL' | 'ACTIVE';
  billing: 'MONTHLY' | 'ANNUAL';
  customPrice: string;
}

const EMPTY: Draft = {
  name: '',
  city: '',
  state: 'Maharashtra',
  flats: '',
  address1: '',
  address2: '',
  pincode: '',
  slug: '',
  slugEdited: false,
  legalName: '',
  registrationNo: '',
  gstin: '',
  organizationId: '',
  aname: '',
  aemail: '',
  amobile: '',
  role: 'chairman',
  plan: 'STANDARD',
  start: 'TRIAL',
  billing: 'MONTHLY',
  customPrice: '',
};

type Errors = Partial<Record<keyof Draft, string>>;

/** API field paths of 8.4 mapped to the wizard step and field. */
const FIELD_MAP: Record<string, [1 | 2 | 3, keyof Draft]> = {
  'society.name': [1, 'name'],
  'society.legalName': [1, 'legalName'],
  'society.slug': [1, 'slug'],
  'society.registrationNo': [1, 'registrationNo'],
  'society.gstin': [1, 'gstin'],
  'society.addressLine1': [1, 'address1'],
  'society.addressLine2': [1, 'address2'],
  'society.city': [1, 'city'],
  'society.state': [1, 'state'],
  'society.pincode': [1, 'pincode'],
  'society.approxFlats': [1, 'flats'],
  'society.organizationId': [1, 'organizationId'],
  'firstAdmin.name': [2, 'aname'],
  'firstAdmin.mobile': [2, 'amobile'],
  'firstAdmin.email': [2, 'aemail'],
  'firstAdmin.roleKey': [2, 'role'],
  'plan.planKey': [3, 'plan'],
  'plan.billingCycle': [3, 'billing'],
  'plan.startAs': [3, 'start'],
  'plan.customPricePerFlatPaise': [3, 'customPrice'],
};

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STEPS = ['Society', 'First admin', 'Plan'];

function check(step: number, d: Draft): Errors {
  const e: Errors = {};
  if (step === 1) {
    if (d.name.trim().length < 3) e.name = 'Enter the society name.';
    if (d.address1.trim().length < 5) e.address1 = 'Enter the address (at least 5 characters).';
    if (d.city.trim().length < 2) e.city = 'Enter the city.';
    if (!isValidPincode(d.pincode)) e.pincode = 'Enter a 6 digit pincode.';
    const flats = Number(d.flats);
    if (!Number.isInteger(flats) || flats < 10) e.flats = 'Enter at least 10 flats.';
    else if (flats > 20000) e.flats = 'Enter at most 20,000 flats.';
    if (d.slug && !isValidSlug(d.slug)) e.slug = 'Use 3 to 60 lowercase letters, numbers and single hyphens.';
    if (d.registrationNo && !/^[A-Za-z0-9/\-. ]{1,60}$/.test(d.registrationNo))
      e.registrationNo = 'Use letters, numbers, / - . and spaces (up to 60).';
    if (d.gstin && !GSTIN.test(d.gstin.trim().toUpperCase())) e.gstin = 'Enter a valid 15 character GSTIN.';
    if (d.plan === 'ENTERPRISE' && d.organizationId && !(Number(d.organizationId) > 0))
      e.organizationId = 'Enter the organization number.';
  }
  if (step === 2) {
    if (d.aname.trim().length < 2) e.aname = 'Enter the admin name.';
    if (!isValidEmail(d.aemail)) e.aemail = 'Enter a valid email.';
    if (!isValidMobile(d.amobile)) e.amobile = 'Enter a 10 digit Indian mobile number.';
  }
  if (step === 3 && d.plan === 'ENTERPRISE' && d.customPrice) {
    const p = rupeesToPaise(d.customPrice);
    if (p === null || p < 100 || p > 100000) e.customPrice = 'Enter a price between ₹1 and ₹1,000 per flat.';
  }
  return e;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (s: CreatedSociety) => void;
}

/** P-02 Add society wizard (prototype `Actions['soc-add']`): Society, First admin, Plan. */
export function AddSocietyWizard({ open, onClose, onCreated }: Props) {
  const canApprove = usePermission(PERMISSIONS.platform.societies.approve);
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<string[] | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [slugCheck, setSlugCheck] = useState<SlugAvailability | null>(null);
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  const slug = d.slugEdited ? d.slug : slugify(d.name);

  useEffect(() => {
    if (!open || plans) return;
    subscriptionsService.plans().then(setPlans, () => setPlans([]));
  }, [open, plans]);

  // Live slug availability (8.3), debounced.
  useEffect(() => {
    if (!open || step !== 1 || !isValidSlug(slug)) return;
    let live = true;
    const id = setTimeout(() => {
      societiesService.slugAvailability(slug).then(
        r => live && setSlugCheck(r),
        () => live && setSlugCheck(null),
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [open, step, slug]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD(prev => ({ ...prev, [k]: v }));
    setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const reset = () => {
    setStep(1);
    setD(EMPTY);
    setErrors({});
    setAlert(null);
    setDuplicates(null);
    setConfirmDup(false);
    setSuggestions([]);
    setSlugCheck(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const plan = plans?.find(p => p.code === d.plan);
  const price = plan?.currentVersion?.pricePerFlatPaise ?? 0;
  const minFlats = plan?.currentVersion?.minBillableFlats ?? 0;
  const freeMonths = plan?.currentVersion?.annualFreeMonths ?? 0;
  const flats = Math.max(Number(d.flats) || 0, minFlats);
  const custom = d.plan === 'ENTERPRISE' ? rupeesToPaise(d.customPrice) : null;
  const estimate = monthlyEquivalent(flats, custom ?? price, d.billing, freeMonths);
  const pctOff = Math.round((freeMonths / 12) * 100);

  const submit = async () => {
    setBusy(true);
    setAlert(null);
    try {
      const created = await societiesService.create({
        society: {
          name: d.name.trim(),
          legalName: d.legalName.trim() || undefined,
          slug: slug || undefined,
          registrationNo: d.registrationNo.trim() || undefined,
          gstin: d.gstin.trim().toUpperCase() || undefined,
          addressLine1: d.address1.trim(),
          addressLine2: d.address2.trim() || undefined,
          city: d.city.trim(),
          state: d.state,
          pincode: d.pincode.trim(),
          approxFlats: Number(d.flats),
          organizationId: d.plan === 'ENTERPRISE' && d.organizationId ? Number(d.organizationId) : undefined,
        },
        firstAdmin: {
          name: d.aname.trim(),
          mobile: normaliseMobile(d.amobile),
          email: d.aemail.trim().toLowerCase(),
          roleKey: d.role,
        },
        plan: {
          planKey: d.plan,
          billingCycle: d.billing,
          startAs: d.start,
          customPricePerFlatPaise: custom ?? undefined,
        },
        confirmNotDuplicate: confirmDup || undefined,
      });
      toast.show(`${created.name} created. Invite sent to ${d.aemail.trim()}.`);
      reset();
      onCreated(created);
    } catch (e) {
      if (!(e instanceof ApiError)) return setAlert(societyErrorText(e));
      if (e.code === 'SLUG_TAKEN' || e.code === 'SLUG_RESERVED') {
        const s = e.errors?.[0]?.suggestions;
        setSuggestions(Array.isArray(s) ? (s as string[]) : []);
        setD(prev => ({ ...prev, slug, slugEdited: true }));
        setErrors({ slug: societyErrorText(e) });
        setStep(1);
      } else if (e.code === 'POSSIBLE_DUPLICATE_SOCIETY') {
        setDuplicates(
          (e.errors ?? []).map(x => {
            const r = x as unknown as { name?: string; city?: string; id?: number; societyId?: number };
            const id = r.societyId ?? r.id;
            return [r.name, r.city].filter(Boolean).join(', ') + (id ? ` (#${id})` : '');
          }),
        );
        setStep(1);
      } else if (e.code === 'INVITATION_CONFLICT') {
        setAlert(societyErrorText(e));
        setStep(2);
      } else if (e.code === 'VALIDATION_FAILED' && e.errors?.length) {
        const next: Errors = {};
        let first: 1 | 2 | 3 = 3;
        for (const f of e.errors) {
          const m = FIELD_MAP[f.field];
          if (!m) continue;
          next[m[1]] = f.message;
          first = Math.min(first, m[0]) as 1 | 2 | 3;
        }
        setErrors(next);
        setStep(first);
        if (Object.keys(next).length === 0) setAlert(e.message);
      } else {
        setAlert(societyErrorText(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    const e = check(step, { ...d, slug });
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step === 1 && duplicates && !confirmDup) {
      setAlert('Confirm that this is a different society, or cancel.');
      return;
    }
    setAlert(null);
    if (step < 3) setStep(step + 1);
    else void submit();
  };

  const back = () => {
    setAlert(null);
    if (step === 1) close();
    else setStep(step - 1);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Add society"
      description={`Step ${step} of 3`}
      footer={
        <>
          <Button variant="ghost" onClick={back}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button loading={busy} onClick={next}>
            {step === 3 ? 'Create society' : 'Next'}
          </Button>
        </>
      }
    >
      <ol className="mb-4 flex gap-1.5" aria-label="Steps">
        {STEPS.map((t, i) => (
          <li key={t} className="flex-1" aria-current={i + 1 === step ? 'step' : undefined}>
            <div className="h-[5px] overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]">
              <div className={cx('h-full bg-navy', i < step ? 'w-full' : 'w-0')} />
            </div>
            <div className={cx('mt-1 text-[12px]', i + 1 === step ? 'font-bold text-ink' : 'text-muted')}>
              {i + 1}. {t}
            </div>
          </li>
        ))}
      </ol>
      <div aria-live="assertive">{alert && <Alert tone="bad">{alert}</Alert>}</div>

      {step === 1 && (
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          {duplicates && (
            <div className="sm:col-span-2">
              <Alert tone="warn">
                A society with a similar name already exists at this pincode:{' '}
                {duplicates.join('; ') || 'one match'}.
              </Alert>
              <Checkbox
                label="This is a different society. Create it anyway."
                checked={confirmDup}
                onChange={e => setConfirmDup(e.target.checked)}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <Input
              label="Society name"
              placeholder="e.g. Lotus Residency CHS"
              value={d.name}
              onChange={e => set('name', e.target.value)}
              error={errors.name}
              required
            />
          </div>
          <Input
            label="Address line 1"
            value={d.address1}
            onChange={e => set('address1', e.target.value)}
            error={errors.address1}
            required
          />
          <Input label="Address line 2" value={d.address2} onChange={e => set('address2', e.target.value)} />
          <Input
            label="City"
            placeholder="Pune"
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
            placeholder="120"
            value={d.flats}
            onChange={e => set('flats', e.target.value)}
            error={errors.flats}
            required
          />
          <div className="sm:col-span-2">
            <Input
              label="Web address"
              value={slug}
              onChange={e =>
                setD(prev => ({ ...prev, slug: e.target.value.toLowerCase(), slugEdited: true }))
              }
              error={errors.slug}
              hint={
                slugCheck && slugCheck.slug === slug
                  ? slugCheck.available
                    ? `${slug}.societyapp.in is available.`
                    : slugCheck.reason === 'RESERVED'
                      ? 'This address is reserved.'
                      : 'This address is taken.'
                  : `${slug || 'your-society'}.societyapp.in`
              }
            />
            {(() => {
              const list =
                slugCheck && slugCheck.slug === slug && !slugCheck.available
                  ? slugCheck.suggestions
                  : suggestions;
              return list.length > 0 ? (
                <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-muted">Try:</span>
                  {list.map(s => (
                    <Button
                      key={s}
                      size="xs"
                      variant="glass"
                      onClick={() => {
                        setD(prev => ({ ...prev, slug: s, slugEdited: true }));
                        setErrors(prev => ({ ...prev, slug: undefined }));
                        setSuggestions([]);
                      }}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
          <Input label="Legal name" value={d.legalName} onChange={e => set('legalName', e.target.value)} />
          <Input
            label="Registration no."
            value={d.registrationNo}
            onChange={e => set('registrationNo', e.target.value)}
            error={errors.registrationNo}
          />
          <Input
            label="GSTIN"
            value={d.gstin}
            onChange={e => set('gstin', e.target.value.toUpperCase())}
            error={errors.gstin}
          />
          {d.plan === 'ENTERPRISE' && (
            <Input
              label="Organization"
              inputMode="numeric"
              value={d.organizationId}
              onChange={e => set('organizationId', e.target.value.replace(/\D/g, ''))}
              error={errors.organizationId}
              hint="Organization number from Organizations. Optional."
            />
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Admin name"
              placeholder="Chairman or secretary"
              value={d.aname}
              onChange={e => set('aname', e.target.value)}
              error={errors.aname}
              required
            />
          </div>
          <Input
            label="Admin email"
            type="email"
            placeholder="chairman@society.in"
            value={d.aemail}
            onChange={e => set('aemail', e.target.value)}
            error={errors.aemail}
            required
          />
          <Input
            label="Admin mobile"
            type="tel"
            inputMode="tel"
            placeholder="98XXXXXXXX"
            value={d.amobile}
            onChange={e => set('amobile', e.target.value)}
            error={errors.amobile}
            required
          />
          <div className="sm:col-span-2">
            <Select
              label="Role"
              value={d.role}
              onChange={e => set('role', e.target.value as FirstAdminRole)}
              options={[
                { value: 'chairman', label: 'Chairman' },
                { value: 'society_admin', label: 'Society Admin' },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <Alert tone="info">
              An invite goes to this admin. They sign in with a mobile OTP and complete the 8-step onboarding
              wizard.
            </Alert>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <fieldset className="mb-4">
            <legend className="mb-1.5 text-[13px] font-semibold">Plan</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(plans && plans.length
                ? plans.map(p => p.code)
                : (Object.keys(PLAN_LABEL) as SocietyPlanKey[])
              ).map(code => {
                const p = plans?.find(x => x.code === code);
                return (
                  <label
                    key={code}
                    className={cx(
                      'flex cursor-pointer flex-col gap-0.5 rounded-[16px] border-[1.5px] bg-white/70 p-3 text-[13px]',
                      d.plan === code ? 'border-navy' : 'border-[rgba(20,35,44,0.16)]',
                    )}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={code}
                      checked={d.plan === code}
                      onChange={() => set('plan', code as SocietyPlanKey)}
                      className="sr-only"
                    />
                    <b className="text-[14px]">{p?.name ?? PLAN_LABEL[code] ?? code}</b>
                    {p && (
                      <span className="text-muted">
                        {inr(p.currentVersion.pricePerFlatPaise)} per flat/month
                        <br />
                        min {p.currentVersion.minBillableFlats} flats
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <Select
              label="Start as"
              value={d.start}
              onChange={e => set('start', e.target.value as 'TRIAL' | 'ACTIVE')}
              options={[
                { value: 'TRIAL', label: 'Free trial (14 days)' },
                ...(canApprove ? [{ value: 'ACTIVE', label: 'Paid subscription now' }] : []),
              ]}
              hint={canApprove ? undefined : 'Paid subscription now needs approve permission.'}
            />
            <Select
              label="Billing cycle"
              value={d.billing}
              onChange={e => set('billing', e.target.value as 'MONTHLY' | 'ANNUAL')}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'ANNUAL', label: pctOff ? `Annual (${pctOff}% off)` : 'Annual' },
              ]}
            />
            {d.plan === 'ENTERPRISE' && canApprove && (
              <Input
                label="Custom price per flat (₹ per month)"
                inputMode="decimal"
                value={d.customPrice}
                onChange={e => set('customPrice', e.target.value)}
                error={errors.customPrice}
                hint="Optional. Enterprise only."
              />
            )}
          </div>
          {plan && (
            <Alert tone="info">
              Estimated {inr(estimate)} per month for {flats.toLocaleString('en-IN')} billable flats (minimum{' '}
              {minFlats}){d.start === 'TRIAL' ? ' after the trial' : ''}. GST is added on the invoice.
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}

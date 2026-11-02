'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import { societySetupService } from '@/services/society-setup.service';
import type { SocietyProfile, SocietyProfileInput } from '@/types/societySetup';
import { INDIAN_STATES, LOCALES, TIMEZONES, fieldErrors, setupError } from './format';

const TYPES = [
  ['COOPERATIVE_HOUSING_SOCIETY', 'Cooperative housing society'],
  ['APARTMENT_OWNERS_ASSOCIATION', 'Apartment owners association'],
  ['RESIDENT_WELFARE_ASSOCIATION', 'Resident welfare association'],
  ['FEDERATION', 'Federation'],
  ['COMMERCIAL_COMPLEX', 'Commercial complex'],
  ['OTHER', 'Other'],
].map(([value, label]) => ({ value, label }));

const nul = (v: string) => (v.trim() === '' ? null : v.trim());

function initial(s: SocietyProfile) {
  return {
    name: s.name,
    legalName: s.legalName ?? '',
    registrationNo: s.registrationNo ?? '',
    gstin: s.gstin ?? '',
    addressLine1: s.addressLine1,
    addressLine2: s.addressLine2 ?? '',
    city: s.city,
    state: s.state,
    pincode: s.pincode,
    timezone: s.timezone,
    locale: s.locale,
    societyType: s.profile.societyType ?? 'COOPERATIVE_HOUSING_SOCIETY',
    pan: s.profile.pan ?? '',
    tan: s.profile.tan ?? '',
    registrationDate: s.profile.registrationDate ?? '',
    contactEmail: s.profile.contactEmail ?? '',
    contactPhone: s.profile.contactPhone ?? '',
  };
}
type Values = ReturnType<typeof initial>;

/** Builds the PATCH body with only the fields that changed (spec 8.3). */
export function profileChanges(
  s: SocietyProfile,
  v: Values,
): Omit<SocietyProfileInput, 'version' | 'reason'> {
  const o = initial(s);
  const body: Omit<SocietyProfileInput, 'version' | 'reason'> = {};
  if (v.name !== o.name) body.name = v.name.trim();
  if (v.legalName !== o.legalName) body.legalName = nul(v.legalName);
  if (v.registrationNo !== o.registrationNo) body.registrationNo = nul(v.registrationNo);
  if (v.gstin !== o.gstin) body.gstin = nul(v.gstin.toUpperCase());
  if (v.addressLine1 !== o.addressLine1) body.addressLine1 = v.addressLine1.trim();
  if (v.addressLine2 !== o.addressLine2) body.addressLine2 = nul(v.addressLine2);
  if (v.city !== o.city) body.city = v.city.trim();
  if (v.state !== o.state) body.state = v.state;
  if (v.pincode !== o.pincode) body.pincode = v.pincode.trim();
  if (v.timezone !== o.timezone) body.timezone = v.timezone;
  if (v.locale !== o.locale) body.locale = v.locale;
  const extras: NonNullable<SocietyProfileInput['profile']> = {};
  if (v.societyType !== o.societyType) extras.societyType = v.societyType;
  if (v.pan !== o.pan) extras.pan = nul(v.pan.toUpperCase());
  if (v.tan !== o.tan) extras.tan = nul(v.tan.toUpperCase());
  if (v.registrationDate !== o.registrationDate) extras.registrationDate = nul(v.registrationDate);
  if (v.contactEmail !== o.contactEmail) extras.contactEmail = nul(v.contactEmail);
  if (v.contactPhone !== o.contactPhone) extras.contactPhone = nul(v.contactPhone);
  if (Object.keys(extras).length) body.profile = extras;
  return body;
}

const isLegal = (b: ReturnType<typeof profileChanges>) =>
  'legalName' in b || 'registrationNo' in b || 'gstin' in b;

/**
 * Society profile form (spec 11.2). `wizard` shows the eight fields of onboarding step 1; the full form adds
 * legal name, PAN, TAN, type, dates, contact and logo. Legal changes ask for a reason (step-up is handled by the API client).
 */
export function ProfileForm({
  society,
  canEdit,
  wizard = false,
  submitLabel = 'Save changes',
  onSaved,
  extraActions,
}: {
  society: SocietyProfile;
  canEdit: boolean;
  wizard?: boolean;
  submitLabel?: string;
  onSaved: (s: SocietyProfile) => void | Promise<void>;
  extraActions?: React.ReactNode;
}) {
  const toast = useToast();
  const [v, setV] = useState<Values>(() => initial(society));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [logoId, setLogoId] = useState<number | null | undefined>(undefined);
  const locked = society.isLive;
  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setV(x => ({ ...x, [k]: e.target.value }));

  const localErrors = () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 3) e.name = 'Enter the society name (at least 3 characters).';
    if (v.addressLine1.trim().length < 5) e.addressLine1 = 'Enter the address (at least 5 characters).';
    if (v.city.trim().length < 2) e.city = 'Enter the city.';
    if (!/^[1-9]\d{5}$/.test(v.pincode.trim())) e.pincode = 'Enter a 6 digit PIN code.';
    if (v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.gstin.toUpperCase()))
      e.gstin = 'Enter a valid 15 character GSTIN or leave it empty.';
    if (v.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v.pan.toUpperCase())) e.pan = 'PAN looks like AAAAA1234A.';
    if (v.tan && !/^[A-Z]{4}\d{5}[A-Z]$/.test(v.tan.toUpperCase())) e.tan = 'TAN looks like AAAA12345A.';
    return e;
  };

  const save = async (reason?: string) => {
    const body: SocietyProfileInput = { version: society.version, ...profileChanges(society, v) };
    if (logoId !== undefined) body.logoFileId = logoId;
    if (reason) body.reason = reason;
    setBusy(true);
    setFormError(null);
    try {
      const next = await societySetupService.updateSociety(body);
      setErrors({});
      setAsking(false);
      toast.show('Society profile saved.');
      await onSaved(next);
    } catch (e) {
      setErrors(fieldErrors(e));
      setFormError(setupError(e));
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const le = localErrors();
    setErrors(le);
    if (Object.keys(le).length) return;
    const body = profileChanges(society, v);
    if (Object.keys(body).length === 0 && logoId === undefined) {
      await onSaved(society);
      return;
    }
    if (isLegal(body)) setAsking(true);
    else await save();
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { fileId } = await uploadFile(file, 'SOCIETY_LOGO');
      setLogoId(fileId);
      toast.show('Logo ready. Save changes to apply it.');
    } catch (e) {
      toast.show(setupError(e), 'error');
    }
  };

  const ro = !canEdit;
  return (
    <form onSubmit={submit} noValidate aria-label="Society profile">
      {formError && <Alert tone="bad">{formError}</Alert>}
      {ro && <Alert tone="info">You can view the profile but not change it.</Alert>}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Society name"
            value={v.name}
            onChange={set('name')}
            error={errors.name}
            disabled={ro}
            required
          />
        </div>
        {!wizard && (
          <div className="sm:col-span-2">
            <Input
              label="Legal name"
              value={v.legalName}
              onChange={set('legalName')}
              error={errors.legalName}
              disabled={ro}
              hint="As on the registration certificate."
            />
          </div>
        )}
        <Input
          label="Registration number"
          value={v.registrationNo}
          onChange={set('registrationNo')}
          error={errors.registrationNo}
          disabled={ro}
        />
        {!wizard && (
          <Input
            label="Registration date"
            type="date"
            value={v.registrationDate}
            onChange={set('registrationDate')}
            error={errors['profile.registrationDate']}
            disabled={ro}
          />
        )}
        {!wizard && (
          <Select
            label="Society type"
            value={v.societyType}
            onChange={set('societyType')}
            options={TYPES}
            disabled={ro}
          />
        )}
        <Input
          label="GSTIN (optional)"
          value={v.gstin}
          onChange={set('gstin')}
          error={errors.gstin}
          disabled={ro}
          maxLength={15}
        />
        {!wizard && (
          <Input
            label="PAN"
            value={v.pan}
            onChange={set('pan')}
            error={errors.pan ?? errors['profile.pan']}
            disabled={ro}
            maxLength={10}
          />
        )}
        {!wizard && (
          <Input
            label="TAN"
            value={v.tan}
            onChange={set('tan')}
            error={errors.tan ?? errors['profile.tan']}
            disabled={ro}
            maxLength={10}
          />
        )}
        <div className="sm:col-span-2">
          <Input
            label="Address line 1"
            value={v.addressLine1}
            onChange={set('addressLine1')}
            error={errors.addressLine1}
            disabled={ro}
            required
          />
        </div>
        {!wizard && (
          <div className="sm:col-span-2">
            <Input
              label="Address line 2"
              value={v.addressLine2}
              onChange={set('addressLine2')}
              error={errors.addressLine2}
              disabled={ro}
            />
          </div>
        )}
        <Input
          label="City"
          value={v.city}
          onChange={set('city')}
          error={errors.city}
          disabled={ro}
          required
        />
        <Select
          label="State"
          value={v.state}
          onChange={set('state')}
          error={errors.state}
          disabled={ro}
          options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
        />
        <Input
          label="PIN code"
          value={v.pincode}
          onChange={set('pincode')}
          error={errors.pincode}
          disabled={ro}
          inputMode="numeric"
          maxLength={6}
          required
        />
        <Select
          label="Time zone"
          value={v.timezone}
          onChange={set('timezone')}
          error={errors.timezone}
          disabled={ro || locked}
          options={(TIMEZONES.includes(v.timezone) ? TIMEZONES : [v.timezone, ...TIMEZONES]).map(t => ({
            value: t,
            label: t === 'Asia/Kolkata' ? 'Asia/Kolkata (IST)' : t,
          }))}
          hint={locked ? 'Cannot change after go-live.' : undefined}
        />
        {!wizard && (
          <>
            <Select
              label="Language"
              value={v.locale}
              onChange={set('locale')}
              options={LOCALES}
              disabled={ro || locked}
              hint={locked ? 'Cannot change after go-live.' : undefined}
            />
            <Input
              label="Office email"
              type="email"
              value={v.contactEmail}
              onChange={set('contactEmail')}
              error={errors['profile.contactEmail']}
              disabled={ro}
            />
            <Input
              label="Office phone"
              value={v.contactPhone}
              onChange={set('contactPhone')}
              error={errors['profile.contactPhone']}
              disabled={ro}
              inputMode="tel"
            />
            <div className="sm:col-span-2">
              <label htmlFor="logo-file" className="mb-1.5 block text-[13px] font-semibold">
                Logo
              </label>
              <input
                id="logo-file"
                type="file"
                accept="image/png,image/jpeg"
                disabled={ro || !fileUploadAvailable()}
                onChange={e => void pickLogo(e.target.files?.[0])}
              />
              <p className="mt-1.5 text-[12.5px] text-muted">
                {fileUploadAvailable()
                  ? society.logoFileId || logoId
                    ? 'A logo is set. Choose a file to replace it.'
                    : 'PNG or JPG, shown on invoices and receipts.'
                  : 'Logo upload is not available yet.'}
              </p>
            </div>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {extraActions}
        {canEdit && (
          <Button type="submit" loading={busy && !asking}>
            {submitLabel}
          </Button>
        )}
      </div>
      <ConfirmReason
        open={asking}
        title="Change legal details?"
        description="Legal name, registration number and GSTIN appear on invoices. The change is recorded with your reason."
        confirmLabel="Save changes"
        variant="primary"
        minLength={5}
        onCancel={() => setAsking(false)}
        onConfirm={save}
      />
    </form>
  );
}

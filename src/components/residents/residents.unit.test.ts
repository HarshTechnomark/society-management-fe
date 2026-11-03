import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { sampleMe } from '@/test/helpers';
import { visibleAdminNav } from '@/components/setup/AdminNav';
import { visibleResidentNav } from './app/ResidentNav';
import {
  agreementEndInfo,
  daysTo,
  docPurpose,
  existingResidentId,
  missingDocuments,
  residentsError,
  slotConflicts,
} from './format';
import { vaccination } from './app/PetsScreen';

/** Every code of spec section 12 (and the codes it passes through). */
const SECTION_12 = [
  'VALIDATION_FAILED',
  'OWNER_ACTION_ONLY',
  'HOUSEHOLD_CONTROL_REQUIRED',
  'EMERGENCY_PROFILE_LOCKED',
  'DIRECTORY_DISABLED',
  'RESIDENT_NOT_FOUND',
  'LINK_NOT_FOUND',
  'UNIT_NOT_FOUND',
  'TENANCY_NOT_FOUND',
  'DOCUMENT_NOT_FOUND',
  'JOIN_REQUEST_NOT_FOUND',
  'MOVE_REQUEST_NOT_FOUND',
  'PERMIT_NOT_FOUND',
  'TRANSFER_NOT_FOUND',
  'PET_NOT_FOUND',
  'SOS_NOT_FOUND',
  'SOCIETY_CODE_NOT_FOUND',
  'IMPORT_JOB_NOT_FOUND',
  'RESIDENT_MOBILE_EXISTS',
  'RESIDENT_HAS_ACTIVE_LINKS',
  'LINK_ALREADY_ACTIVE',
  'OWNER_ALREADY_EXISTS',
  'ALREADY_LINKED',
  'JOIN_REQUEST_EXISTS',
  'TENANCY_ALREADY_ACTIVE',
  'MOVE_REQUEST_EXISTS',
  'MOVE_SLOT_CONFLICT',
  'PERMIT_EXISTS',
  'TRANSFER_EXISTS',
  'TRANSFER_SELLER_MISMATCH',
  'DOCUMENT_IN_USE',
  'IMPORT_RUNNING',
  'UNIT_NOT_RESIDENTIAL',
  'OWNER_REQUIRED',
  'OWNERSHIP_SHARE_INVALID',
  'PRIMARY_MUST_BE_OWNER',
  'LINK_DATES_INVALID',
  'NO_LIVE_TENANCY',
  'USE_TENANCY_FLOW',
  'MINOR_NOT_ALLOWED',
  'INVITE_NOT_POSSIBLE',
  'MOBILE_MANAGED_BY_USER',
  'MEMBER_HAS_LOGIN',
  'DOCUMENT_TYPE_NOT_ALLOWED',
  'DOCUMENTS_REQUIRED',
  'SOCIETY_NOT_JOINABLE',
  'PROFILE_INCOMPLETE',
  'TENANCY_DATES_INVALID',
  'TENANCY_STATE_INVALID',
  'VERIFICATION_DETAILS_REQUIRED',
  'MOVE_SLOT_NOT_ALLOWED',
  'GATE_PASS_INVALID',
  'DEDUCTION_TOO_HIGH',
  'PERMIT_DATES_INVALID',
  'PERMIT_HOURS_NOT_ALLOWED',
  'PERMIT_EXPIRED',
  'EXTENSION_LIMIT_REACHED',
  'TRANSFER_DATE_INVALID',
  'TRANSFER_PARTIES_INVALID',
  'TRANSFER_DUES_PENDING',
  'FEE_ABOVE_CAP',
  'PET_VACCINATION_REQUIRED',
  'CONSENT_REQUIRED',
  'FILTER_TOO_BROAD',
  'EXPORT_TOO_LARGE',
  'IMPORT_TOO_LARGE',
  'IMPORT_FORMAT_INVALID',
  'INVITATION_ALREADY_PENDING',
  'ALREADY_MEMBER',
  'MEMBER_SUSPENDED',
  'EMAIL_IN_USE',
  'ACCOUNT_DISABLED',
  'REAUTH_REQUIRED',
  'FILE_NOT_LINKABLE',
  'FILE_NOT_READY',
  'FILE_INFECTED',
  'REQUEST_IN_PROGRESS',
  'SUPPORT_ROUTE_FORBIDDEN',
  'SOCIETY_CLOSED',
  'FEATURE_NOT_IN_PLAN',
  'NO_BILL_TO',
  'DUPLICATE_ADHOC_CHARGE',
  'CHARGE_HEAD_ARCHIVED',
  'APPROVAL_ALREADY_PENDING',
  'STALE_VERSION',
  'INVALID_STATE',
  'MAKER_CHECKER_VIOLATION',
];

/** Every code the real module 09 backend throws on its routes (read from the backend source). */
const BACKEND_CODES =
  `ALREADY_LINKED APPROVAL_NOT_FOUND CONSENT_REQUIRED DEDUCTION_TOO_HIGH DIRECTORY_DISABLED DOCUMENTS_REQUIRED
DOCUMENT_IN_USE DOCUMENT_NOT_FOUND DOCUMENT_TYPE_NOT_ALLOWED EMERGENCY_PROFILE_LOCKED EXPORT_TOO_LARGE EXTENSION_LIMIT_REACHED
FEE_ABOVE_CAP FILE_NOT_LINKABLE FILTER_TOO_BROAD GATE_PASS_INVALID HOUSEHOLD_CONTROL_REQUIRED IMPORT_FORMAT_INVALID
IMPORT_JOB_NOT_FOUND IMPORT_RUNNING IMPORT_TOO_LARGE INVALID_STATE INVITE_NOT_POSSIBLE JOIN_REQUEST_EXISTS JOIN_REQUEST_NOT_FOUND
LINK_ALREADY_ACTIVE LINK_DATES_INVALID LINK_NOT_FOUND MEMBER_HAS_LOGIN MINOR_NOT_ALLOWED MOBILE_MANAGED_BY_USER
MOVE_REQUEST_EXISTS MOVE_REQUEST_NOT_FOUND MOVE_SLOT_CONFLICT MOVE_SLOT_NOT_ALLOWED NO_LIVE_TENANCY OWNERSHIP_SHARE_INVALID
OWNER_ACTION_ONLY OWNER_ALREADY_EXISTS OWNER_REQUIRED PERMISSION_DENIED PERMIT_DATES_INVALID PERMIT_EXISTS PERMIT_EXPIRED
PERMIT_HOURS_NOT_ALLOWED PERMIT_NOT_FOUND PET_NOT_FOUND PET_VACCINATION_REQUIRED PRIMARY_MUST_BE_OWNER PROFILE_INCOMPLETE
RESIDENT_HAS_ACTIVE_LINKS RESIDENT_MOBILE_EXISTS RESIDENT_NOT_FOUND SOCIETY_CODE_NOT_FOUND SOCIETY_NOT_JOINABLE SOS_NOT_FOUND
STALE_VERSION TENANCY_ALREADY_ACTIVE TENANCY_DATES_INVALID TENANCY_NOT_FOUND TENANCY_STATE_INVALID TRANSFER_DATE_INVALID
TRANSFER_DUES_PENDING TRANSFER_EXISTS TRANSFER_NOT_FOUND TRANSFER_PARTIES_INVALID TRANSFER_SELLER_MISMATCH UNIT_NOT_FOUND
UNIT_NOT_RESIDENTIAL USE_TENANCY_FLOW VALIDATION_FAILED VERIFICATION_DETAILS_REQUIRED`.split(/\s+/);

describe('docPurpose', () => {
  it.each(['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'OTHER_ID', 'ADDRESS_PROOF'])(
    '%s is a KYC document',
    t => expect(docPurpose(t)).toBe('KYC_DOCUMENT'),
  );
  it.each(['RENT_AGREEMENT', 'POLICE_VERIFICATION', 'NOC', 'SALE_DEED', 'OTHER'])(
    '%s is a resident record',
    t => expect(docPurpose(t)).toBe('RESIDENT_RECORD'),
  );
});

describe('residentsError (spec section 12)', () => {
  it.each(BACKEND_CODES)('backend code %s has its own plain-words message', code => {
    expect(residentsError(new ApiError(409, code, 'raw server message'))).not.toBe('raw server message');
  });

  it('lists the missing documents of DOCUMENTS_REQUIRED by name', () => {
    const e = new ApiError(422, 'DOCUMENTS_REQUIRED', 'Attach', [
      { field: 'fileIds', message: 'Missing: SALE_DEED, INDEX_II', missing: ['SALE_DEED', 'INDEX_II'] },
    ]);
    expect(missingDocuments(e)).toEqual(['SALE_DEED', 'INDEX_II']);
    expect(residentsError(e)).toMatch(/Still needed: .*Sale deed/);
    expect(missingDocuments(new Error('x'))).toEqual([]);
  });

  it('lists the booked slots of MOVE_SLOT_CONFLICT', () => {
    const e = new ApiError(409, 'MOVE_SLOT_CONFLICT', 'busy', [
      { field: 'slotStart', message: 'busy', conflicts: [{ slotStart: '10:00', slotEnd: '12:00' }] },
    ]);
    expect(slotConflicts(e)).toEqual(['10:00 to 12:00']);
    expect(residentsError(e)).toContain('Booked: 10:00 to 12:00.');
  });

  it.each(SECTION_12)('%s has its own plain-words message', code => {
    const text = residentsError(new ApiError(409, code, 'raw server message'));
    expect(text).not.toBe('raw server message');
    expect(text.length).toBeGreaterThan(10);
  });

  it('falls back to the server message for an unknown code and to plain text for other errors', () => {
    expect(residentsError(new ApiError(500, 'WEIRD', 'server says'))).toBe('server says');
    expect(residentsError(new Error('boom'))).toBe('boom');
    expect(residentsError('x')).toBe('Something went wrong. Try again.');
  });

  it('reads the existing resident id of RESIDENT_MOBILE_EXISTS', () => {
    const e = new ApiError(409, 'RESIDENT_MOBILE_EXISTS', 'm', [
      { field: 'mobile', message: 'exists', residentId: 5101 },
    ]);
    expect(existingResidentId(e)).toBe(5101);
    expect(existingResidentId(new ApiError(409, 'OTHER', 'm'))).toBeNull();
  });
});

describe('dates and chips', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('counts days to a date', () => {
    expect(daysTo('2026-11-13', now)).toBe(10);
    expect(daysTo('2026-11-01', now)).toBe(-2);
    expect(daysTo(null, now)).toBeNull();
  });
  it('marks agreement ends: overstay as bad, within 30 days as warn, otherwise neutral', () => {
    expect(agreementEndInfo('2026-01-01', 'EXPIRED_OVERSTAY').tone).toBe('bad');
    expect(agreementEndInfo('2020-01-01', 'ACTIVE').tone).toBe('bad');
    expect(agreementEndInfo('2999-01-01', 'ACTIVE').tone).toBe('neutral');
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const i = agreementEndInfo(soon, 'ACTIVE');
    expect(i.tone).toBe('warn');
    expect(i.text).toMatch(/ends in \d+ days?/);
  });
  it('words the pet vaccination state', () => {
    const base = { id: 1, name: 'Rex', species: 'DOG' as const, version: 1 };
    expect(vaccination({ ...base, vaccinationValidUntil: '2000-01-01' }).text).toBe('Vaccination expired');
    expect(vaccination({ ...base, vaccinationValidUntil: '2999-01-01' }).text).toBe('Vaccination valid');
    expect(vaccination(base).text).toBe('Vaccination not recorded');
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(vaccination({ ...base, vaccinationValidUntil: soon }).text).toMatch(/due in/);
  });
});

describe('navigation', () => {
  it('shows Residents in the admin menu only with residents.people.view', () => {
    const labels = (perms: string[]) =>
      visibleAdminNav(sampleMe({ permissions: perms })).flatMap(g => g.items.map(i => i.label));
    expect(labels(['residents.people.view'])).toContain('Residents');
    expect(labels(['settings.members.view'])).not.toContain('Residents');
  });
  it('always shows Join in the resident menu and the rest by permission', () => {
    const labels = (perms: string[]) =>
      visibleResidentNav(sampleMe({ permissions: perms })).map(i => i.label);
    expect(labels([])).toEqual(['Join a society']);
    expect(labels(['resident.home.view', 'resident.requests.view'])).toEqual(
      expect.arrayContaining(['Requests', 'Privacy', 'My pets']),
    );
    expect(labels(['resident.requests.view'])).not.toContain('Privacy');
  });
});

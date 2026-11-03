import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { normaliseOverview, normaliseTerm } from '@/services/committeeMappers';
import { KNOWN_ERROR_CODES, bannerText, committeeError, existingDraftId, seatLabel } from './format';

/** Every code of spec section 12. */
const SPEC_CODES = [
  'VALIDATION_FAILED',
  'REAUTH_REQUIRED',
  'FEATURE_NOT_IN_PLAN',
  'USAGE_LIMIT_EXCEEDED',
  'PERMISSION_DENIED',
  'CANNOT_GRANT_UNHELD_PERMISSION',
  'SELF_CHANGE_NOT_ALLOWED',
  'COMMITTEE_TERM_NOT_FOUND',
  'COMMITTEE_SEAT_NOT_FOUND',
  'HANDOVER_ITEM_NOT_FOUND',
  'STALE_VERSION',
  'INVALID_STATE',
  'IDEMPOTENCY_KEY_REUSED',
  'COMMITTEE_DRAFT_EXISTS',
  'COMMITTEE_PREVIEW_STALE',
  'LAST_CHAIRMAN',
  'COMMITTEE_TERM_DATES_INVALID',
  'COMMITTEE_TERM_NOT_STARTED',
  'COMMITTEE_STRENGTH_INVALID',
  'COMMITTEE_DESIGNATION_DUPLICATE',
  'COMMITTEE_HOLDER_DUPLICATE',
  'COMMITTEE_OFFICE_BEARERS_REQUIRED',
  'COMMITTEE_CHAIRMAN_REQUIRED',
  'COMMITTEE_HOLDER_NOT_MEMBER',
  'COMMITTEE_HOLDER_NOT_ACTIVE',
  'COMMITTEE_HOLDER_INELIGIBLE',
  'COMMITTEE_ROLE_CONFLICT',
  'COMMITTEE_ELECTED_SEATS_LOCKED',
  'COMMITTEE_COOPTION_NOT_ALLOWED',
  'COMMITTEE_CHANGE_INVALID',
  'COMMITTEE_SEAT_LIMIT',
  'HANDOVER_ITEM_LIMIT',
  'FILE_NOT_LINKABLE',
  'SOCIETY_SUSPENDED',
  'SOCIETY_CLOSED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
];

describe('committeeError', () => {
  it.each(SPEC_CODES)('has plain words for %s, not the raw API message', code => {
    const text = committeeError(new ApiError(422, code, 'raw server text'));
    expect(text).not.toBe('raw server text');
    expect(text.length).toBeGreaterThan(10);
    expect(KNOWN_ERROR_CODES).toContain(code);
  });
  it('has words for the 401 of an ended session', () => {
    expect(committeeError(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue'))).toContain('Sign in');
  });
  it('uses the exact texts of spec 11.3 and 11.4', () => {
    expect(committeeError(new ApiError(422, 'COMMITTEE_HOLDER_INELIGIBLE', 'x'))).toBe(
      'Only flat owners can be on the committee.',
    );
    expect(committeeError(new ApiError(422, 'COMMITTEE_HOLDER_NOT_MEMBER', 'x'))).toBe(
      'Not on the app yet. Invite them as a resident first.',
    );
    expect(committeeError(new ApiError(409, 'COMMITTEE_PREVIEW_STALE', 'x'))).toBe(
      'Something changed since you opened this. Review the updated plan.',
    );
    expect(committeeError(new ApiError(422, 'COMMITTEE_CHAIRMAN_REQUIRED', 'x'))).toBe(
      'Pick the new chairman before the current one steps down.',
    );
  });
  it('falls back to the API message for an unknown code and handles plain errors', () => {
    expect(committeeError(new ApiError(400, 'WHO_KNOWS', 'Server says no'))).toBe('Server says no');
    expect(committeeError(new Error('boom'))).toBe('boom');
    expect(committeeError('x')).toBe('Something went wrong. Try again.');
  });
  it('reads the existing draft id of COMMITTEE_DRAFT_EXISTS', () => {
    const e = new ApiError(409, 'COMMITTEE_DRAFT_EXISTS', 'x', [
      { field: 'termId', message: '14', termId: 14 },
    ]);
    expect(existingDraftId(e)).toBe(14);
    expect(existingDraftId(new ApiError(409, 'OTHER', 'x'))).toBeNull();
  });
});

describe('banners and labels', () => {
  const fmt = (s: string | null | undefined) => `D(${s})`;
  it('words the four banners', () => {
    expect(bannerText({ code: 'TERM_ENDING', daysLeft: 28 }, fmt)).toBe(
      'Term ends in 28 days. Plan the election.',
    );
    expect(bannerText({ code: 'TERM_ENDING', daysLeft: 1 }, fmt)).toBe(
      'Term ends in 1 day. Plan the election.',
    );
    expect(bannerText({ code: 'CARETAKER', endedOn: '2029-03-31' }, fmt)).toContain(
      'Term ended on D(2029-03-31). The committee continues as caretaker',
    );
    expect(bannerText({ code: 'DRAFT_FROM_ELECTION' }, fmt)).toBe(
      'Election results are in. Review the new committee.',
    );
    expect(bannerText({ code: 'NO_COMMITTEE' }, fmt)).toContain('No committee recorded yet');
  });
  it('labels a co-opted member', () => {
    expect(seatLabel('MEMBER', 'CO_OPTED')).toBe('Member · Co-opted');
    expect(seatLabel('TREASURER', 'CO_OPTED')).toBe('Treasurer');
    expect(seatLabel('MEMBER', 'ELECTED')).toBe('Member');
  });
});

describe('mappers', () => {
  it('fills defaults for a bare term and never throws on junk', () => {
    const t = normaliseTerm({
      id: 3,
      name: 'X',
      seats: [{ seatId: 'S1', name: 'A', designation: 'CHAIRMAN' }],
    });
    expect(t.seats[0]).toMatchObject({ seatId: 'S1', flags: [], portfolios: [], showOnResidentPage: true });
    expect(t.handover.total).toBe(0);
    expect(() => normaliseTerm(null)).not.toThrow();
    expect(normaliseOverview(undefined)).toEqual({ current: null, draft: null, banner: null });
  });
  it('reads the real draft summary of GET /committee', () => {
    const o = normaliseOverview({
      draft: {
        id: 20,
        name: 'Managing Committee 2029-2034',
        kind: 'ELECTED',
        source: 'ELECTION',
        startDate: '2029-04-01',
        endDate: '2034-03-31',
        strength: 7,
        seatCount: 4,
        electionId: 9,
        version: 2,
      },
    });
    expect(o.draft).toEqual({
      id: 20,
      name: 'Managing Committee 2029-2034',
      kind: 'ELECTED',
      source: 'ELECTION',
      startDate: '2029-04-01',
      endDate: '2034-03-31',
      strength: 7,
      seatCount: 4,
      electionId: 9,
      version: 2,
    });
  });
  it('maps banners and ignores an unknown one', () => {
    expect(normaliseOverview({ banner: { code: 'TERM_ENDING', daysLeft: 9 } }).banner).toEqual({
      code: 'TERM_ENDING',
      daysLeft: 9,
    });
    expect(normaliseOverview({ banner: { code: 'WAT' } }).banner).toBeNull();
  });
});

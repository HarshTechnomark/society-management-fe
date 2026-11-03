import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { fieldErrors, setupError, bhkLabel, sqft } from './format';
import { blankForm, buildGeneratorInput, defaultPattern } from './generator';

const CODES = [
  'VALIDATION_FAILED',
  'UNKNOWN_SETTING_KEY',
  'SETTING_VALUE_INVALID',
  'PATTERN_INVALID',
  'UNAUTHENTICATED',
  'REAUTH_REQUIRED',
  'FEATURE_NOT_IN_PLAN',
  'USAGE_LIMIT_EXCEEDED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'BUILDING_NOT_FOUND',
  'UNIT_NOT_FOUND',
  'LOCATION_NOT_FOUND',
  'HOLIDAY_NOT_FOUND',
  'IMPORT_NOT_FOUND',
  'FILE_NOT_FOUND',
  'STALE_VERSION',
  'INVALID_STATE',
  'IDEMPOTENCY_KEY_REUSED',
  'REQUEST_IN_PROGRESS',
  'BUILDING_CODE_TAKEN',
  'BUILDING_CODE_LOCKED',
  'BUILDING_HAS_ACTIVE_UNITS',
  'BUILDING_IN_USE',
  'UNIT_NUMBER_TAKEN',
  'UNIT_NUMBER_CONFLICT',
  'UNIT_ARCHIVE_BLOCKED',
  'UNIT_DELETE_NOT_ALLOWED',
  'UNIT_IN_USE',
  'PREVIEW_STALE',
  'IMPORT_FILE_NOT_READY',
  'IMPORT_IN_PROGRESS',
  'LOCATION_NAME_TAKEN',
  'HOLIDAY_DATE_TAKEN',
  'ALREADY_LIVE',
  'GSTIN_CHECKSUM_INVALID',
  'GSTIN_STATE_MISMATCH',
  'GSTIN_PAN_MISMATCH',
  'TIMEZONE_LOCKED',
  'SETTING_NOT_EDITABLE_HERE',
  'PREFIX_CLASH',
  'OFFICE_HOURS_INVALID',
  'QUIET_HOURS_INVALID',
  'GST_REQUIRES_GSTIN',
  'LATE_FEE_DEFAULT_INVALID',
  'COMMITTEE_STRENGTH_INVALID',
  'HELPDESK_WAITING_RULE_INVALID',
  'PARENT_BUILDING_INVALID',
  'BUILDING_STRUCTURE_CONFLICT',
  'BUILDING_FLOORS_IN_USE',
  'BUILDING_ARCHIVED',
  'FLOOR_OUT_OF_RANGE',
  'AREA_ORDER_INVALID',
  'SHARE_TOTAL_EXCEEDS_100',
  'PATTERN_NOT_UNIQUE',
  'GENERATOR_TOO_LARGE',
  'IMPORT_TOO_MANY_ROWS',
  'IMPORT_FILE_INVALID',
  'IMPORT_HAS_ERRORS',
  'IMPORT_NOTHING_TO_COMMIT',
  'IMPORT_STALE',
  'FILE_NOT_LINKABLE',
  'LOCATION_PARENT_INVALID',
  'LOCATION_DEPTH_EXCEEDED',
  'LOCATION_CYCLE',
  'LOCATION_MANAGED',
  'ONBOARDING_STEP_INCOMPLETE',
  'ONBOARDING_STEP_NOT_SKIPPABLE',
  'ONBOARDING_NOT_READY',
  'SOCIETY_SUSPENDED',
  'SOCIETY_CLOSED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
];

describe('setupError', () => {
  it.each(CODES)('has its own words for %s (not the raw API message)', code => {
    const text = setupError(new ApiError(400, code, 'RAW'));
    expect(text).not.toBe('RAW');
    expect(text.length).toBeGreaterThan(10);
  });

  it('adds the guard reasons of an archive block', () => {
    const e = new ApiError(409, 'UNIT_ARCHIVE_BLOCKED', 'x', [
      { field: 'module', message: 'UNIT_HAS_RESIDENTS' },
    ]);
    expect(setupError(e)).toContain('active residents');
  });

  it('lists the conflicting labels of a generator commit', () => {
    const e = new ApiError(409, 'UNIT_NUMBER_CONFLICT', 'x', [{ field: 'label', message: 'A-702' }]);
    expect(setupError(e)).toContain('A-702');
  });

  it('names the key of a denied setting', () => {
    const e = new ApiError(403, 'PERMISSION_DENIED', 'x', [{ field: 'billing.dueDays', message: 'no' }]);
    expect(setupError(e)).toContain('billing.dueDays');
  });

  it('maps field errors of a 400', () => {
    const e = new ApiError(400, 'VALIDATION_FAILED', 'x', [{ field: 'name', message: 'Too short' }]);
    expect(fieldErrors(e)).toEqual({ name: 'Too short' });
    expect(fieldErrors(new Error('x'))).toEqual({});
  });
});

describe('formatting', () => {
  it('formats areas and BHK', () => {
    expect(sqft('1150.000')).toBe('1,150');
    expect(sqft(null)).toBe('-');
    expect(bhkLabel('2_5BHK')).toBe('2.5 BHK');
    expect(bhkLabel('STUDIO')).toBe('Studio');
  });
});

describe('generator input', () => {
  it('uses {floor}0{pos} below ten positions and {floor}{pos:2} from ten', () => {
    expect(defaultPattern(4)).toBe('{floor}0{pos}');
    expect(defaultPattern(12)).toBe('{floor}{pos:2}');
  });

  it('builds the API body with skips', () => {
    const f = blankForm();
    f.rows[0] = { mode: 'new', buildingId: '', code: 'a', name: '', kind: 'TOWER' };
    f.floorFrom = '1';
    f.floorTo = '20';
    f.skipFloors = '13, 14';
    f.skipCells = '5:2';
    const r = buildGeneratorInput(f);
    expect(r.errors).toBeUndefined();
    expect(r.input).toMatchObject({
      buildings: [{ newBuilding: { code: 'A', name: 'Tower A', kind: 'TOWER' } }],
      floorFrom: 1,
      floorTo: 20,
      skipFloors: [13, 14],
      skipCells: [{ floor: 5, position: 2 }],
      pattern: '{floor}0{pos}',
    });
    expect(r.input!.positions).toHaveLength(4);
    expect(r.input!.positions[0]).toEqual({ position: 1, unitType: 'FLAT' });
  });

  it('reports bad floors, codes, areas and skips', () => {
    const f = blankForm();
    f.floorTo = '0';
    f.skipFloors = 'x';
    f.skipCells = '5-';
    f.positions[0].carpet = '12.3456';
    const r = buildGeneratorInput(f);
    expect(Object.keys(r.errors!)).toEqual(
      expect.arrayContaining(['building0', 'floorTo', 'skipFloors', 'skipCells', 'pos0.carpet']),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { obList, obRow, obTotals, statement } from '@/test/ledgerFixtures';
import { mapImportResult, mapOpeningList, mapOpeningRow, mapPostResult, mapStatement } from './ledgerMappers';

describe('ledger mappers', () => {
  it('maps an opening balance row and falls back to the label from the file', () => {
    const r = mapOpeningRow(
      obRow({
        unitLabel: undefined,
        unitLabelInput: 'Z-9',
        unitId: null,
        status: 'INVALID',
        validationError: 'Unknown flat',
      }),
    );
    expect(r).toMatchObject({
      unitId: null,
      unitLabel: 'Z-9',
      rowNo: 2,
      status: 'INVALID',
      validationError: 'Unknown flat',
    });
  });
  it('accepts amounts as numeric strings and an unknown status as invalid', () => {
    const r = mapOpeningRow({ id: '4', arrearsPrincipalPaise: '500', status: 'WEIRD' });
    expect(r.id).toBe(4);
    expect(r.arrearsPrincipalPaise).toBe(500);
    expect(r.status).toBe('INVALID');
  });
  it('maps the list with totals from data or from the envelope extra', () => {
    expect(mapOpeningList(obList(), undefined, 2).totals.draftAdvancePaise).toBe(200000);
    expect(mapOpeningList([obRow()], { totals: obTotals({ postedCount: 3 }) }).totals.postedCount).toBe(3);
  });
  it('maps import results with counts or arrays', () => {
    expect(mapImportResult({ draft: 70, invalid: 2, totals: obTotals() })).toMatchObject({
      draftCount: 70,
      invalidCount: 2,
    });
    expect(mapImportResult({ draft: [1, 2, 3], invalid: [1] }).draftCount).toBe(3);
  });
  it('maps the post result and the statement', () => {
    expect(mapPostResult({ posted: 70, totalArrearsPaise: 5, totalAdvancePaise: 1 }).posted).toBe(70);
    const s = mapStatement(statement());
    expect(s.entries[1]).toMatchObject({ creditPaise: 638000, balancePaise: -100000 });
    expect(s.unit.label).toBe('A-1203');
  });
});

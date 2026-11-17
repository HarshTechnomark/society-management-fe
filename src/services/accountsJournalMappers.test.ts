import { describe, expect, it } from 'vitest';
import {
  flattenTree,
  normaliseJournal,
  normaliseJournalDetail,
  normaliseOpening,
  normalisePagination,
  normaliseTree,
} from './accountsJournalMappers';

describe('accounts journal mappers', () => {
  it('reads the tree with children and an absent balance as null', () => {
    const tree = normaliseTree([
      {
        id: 1,
        code: '1000',
        name: 'Assets',
        accountType: 'ASSET',
        isGroup: true,
        isSystem: true,
        balancePaise: 500,
        children: [{ id: 2, code: '1110', name: 'Bank', isActive: false }],
      },
    ]);
    expect(tree[0]!.children[0]).toMatchObject({ id: 2, parentId: 1, isActive: false, balancePaise: null });
    expect(flattenTree(tree).map(a => a.code)).toEqual(['1000', '1110']);
  });
  it('never throws on junk', () => {
    expect(normaliseTree(null)).toEqual([]);
    expect(normaliseJournal(undefined)).toMatchObject({ id: 0, status: 'DRAFT', totalPaise: 0 });
    expect(normalisePagination(null, 3)).toMatchObject({ total: 3, totalPages: 1 });
  });
  it('reads a detail with lines, links and a derived difference', () => {
    const d = normaliseJournalDetail({
      id: 5,
      voucherNo: 'JV/1',
      status: 'POSTED',
      source: 'SYSTEM',
      entryDate: '2026-11-01',
      lines: [
        {
          lineNo: 1,
          ledgerAccountCode: '1110',
          ledgerAccountName: 'Bank',
          debitPaise: 1180000,
          creditPaise: 0,
        },
        {
          lineNo: 2,
          ledgerAccount: { code: '4100', name: 'Maintenance' },
          debitPaise: 0,
          creditPaise: 1080000,
        },
      ],
      reversedBy: { id: 9, voucherNo: 'JV/2' },
      sourceLink: { refType: 'payment', refId: '88', label: 'Receipt 88' },
    });
    expect(d.differencePaise).toBe(100000);
    expect(d.lines[1]!.ledgerAccountCode).toBe('4100');
    expect(d.reversedBy).toEqual({ id: 9, voucherNo: 'JV/2' });
    expect(d.reversalOf).toBeNull();
    expect(d.sourceLink?.label).toBe('Receipt 88');
  });
  it('reads the opening result from a flat or nested shape', () => {
    expect(normaliseOpening({ journalId: 4, voucherNo: 'OB/1', totalPaise: 10050000 })).toMatchObject({
      journalId: 4,
    });
    expect(normaliseOpening({ journal: { id: 7, voucherNo: 'OB/2', totalPaise: 5 } })).toMatchObject({
      journalId: 7,
      voucherNo: 'OB/2',
    });
  });
  it('reads the real API shapes: the timeline and the opening result', () => {
    const d = normaliseJournalDetail({
      id: 1,
      lines: [],
      timeline: [
        { at: '2026-11-03T10:00:00.000Z', action: 'journal.submitted', actorName: 'Meera', reason: null },
      ],
    });
    expect(d.audit).toEqual([
      { at: '2026-11-03T10:00:00.000Z', action: 'journal.submitted', by: 'Meera', note: null },
    ]);
    expect(
      normaliseOpening({
        journalEntryId: 12,
        voucherNo: 'JV/2026-27/000001',
        entryDate: '2026-04-01',
        totalPaise: 500,
        balancingLine: { ledgerAccountCode: '3900', debitPaise: 0, creditPaise: 70 },
      }),
    ).toEqual({
      journalId: 12,
      voucherNo: 'JV/2026-27/000001',
      asOfDate: '2026-04-01',
      totalPaise: 500,
      autoBalancePaise: 70,
    });
  });
});

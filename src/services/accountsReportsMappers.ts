/**
 * Turns the module 13 report answers (spec 8.19) into one generic table view. Money is integer paise.
 * Only the trial balance shape is given in full by the spec; the others are read leniently (several spellings
 * of the same field) and an unknown shape gives an empty view, never an exception.
 */
import { inr, shortDate } from '@/lib/money';
import type { ReportBlock, ReportCell, ReportKey, ReportView, LedgerOption } from '@/types/accountsReports';

type R = Record<string, unknown>;
const obj = (v: unknown): R => (v && typeof v === 'object' ? (v as R) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const numN = (v: unknown): number | undefined =>
  v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const pick = (r: R, ...keys: string[]): unknown => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};

export const HEADINGS: Record<ReportKey, string> = {
  'trial-balance': 'Trial balance',
  'income-expenditure': 'Income and expenditure',
  'balance-sheet': 'Balance sheet',
  'general-ledger': 'General ledger',
  'receipts-payments': 'Receipts and payments',
  'gst-summary': 'GST summary',
  'tds-register': 'TDS register',
};

const money = (p: unknown, right = true, bold = false): ReportCell => ({
  text: inr(num(p)),
  right,
  bold,
});
const text = (t: string, extra: Partial<ReportCell> = {}): ReportCell => ({ text: t, ...extra });
const dash = (p: unknown): ReportCell => (num(p) === 0 ? text('-', { right: true }) : money(p));
const accountCell = (r: R): ReportCell => {
  const id = numN(pick(r, 'ledgerAccountId', 'accountId'));
  const code = str(r.code);
  return text(
    `${code ? `${code}  ` : ''}${str(r.name)}`.trim(),
    id ? { ledgerAccountId: id, ledgerCode: code } : {},
  );
};

export function periodText(raw: R, report: ReportKey): string {
  const asOf = str(raw.asOf);
  if (report === 'trial-balance' || report === 'balance-sheet') return asOf ? `As of ${shortDate(asOf)}` : '';
  const from = str(raw.from);
  const to = str(raw.to);
  return from && to ? `${shortDate(from)} to ${shortDate(to)}` : '';
}

/** One block of the flat 8.19 rows (`section`, `code`, `name`, `amountPaise`); group rows are shown in bold. */
function sectionBlock(
  title: string,
  rows: R[],
  section: string,
  totalLabel: string,
  total: unknown,
): ReportBlock {
  const mine = rows.filter(r => r.section === section || r.side === section);
  return {
    title,
    columns: [{ label: 'Account' }, { label: 'Amount', right: true }],
    rows: mine.map(r => {
      const c = accountCell(r);
      return [r.isGroup === true ? { ...c, bold: true } : c, dash(r.amountPaise)];
    }),
    total: [text(totalLabel, { bold: true }), money(total ?? sumOf(mine), true, true)],
  };
}
const sumOf = (rows: R[]) => rows.reduce<number>((s, x) => s + num(x.amountPaise), 0);

export function normaliseReport(report: ReportKey, rawIn: unknown): ReportView {
  const raw = obj(rawIn);
  const view: ReportView = {
    report,
    heading: HEADINGS[report],
    periodText: periodText(raw, report),
    balanced: typeof raw.balanced === 'boolean' ? raw.balanced : null,
    blocks: [],
    summary: [],
    empty: false,
  };
  switch (report) {
    case 'trial-balance': {
      const rows = arr(raw.rows);
      const t = obj(raw.totals);
      view.blocks = [
        {
          title: null,
          columns: [{ label: 'Account' }, { label: 'Debit', right: true }, { label: 'Credit', right: true }],
          rows: rows.map(x => [accountCell(obj(x)), dash(obj(x).debitPaise), dash(obj(x).creditPaise)]),
          total: [
            text('Total', { bold: true }),
            money(t.debitPaise, true, true),
            money(t.creditPaise, true, true),
          ],
        },
      ];
      view.empty = rows.length === 0;
      break;
    }
    case 'income-expenditure': {
      const rows = arr(raw.rows).map(obj);
      const t = obj(raw.totals);
      view.blocks = [
        sectionBlock('Income', rows, 'INCOME', 'Total income', t.incomePaise),
        sectionBlock('Expenditure', rows, 'EXPENDITURE', 'Total expenditure', t.expenditurePaise),
      ];
      const sp = numN(t.surplusPaise);
      if (sp !== undefined)
        view.summary = [
          { label: sp < 0 ? 'Deficit for the period' : 'Surplus for the period', value: inr(Math.abs(sp)) },
        ];
      view.empty = rows.length === 0;
      break;
    }
    case 'balance-sheet': {
      const rows = arr(raw.rows).map(obj);
      const t = obj(raw.totals);
      view.blocks = [
        sectionBlock('Assets', rows, 'ASSETS', 'Total assets', t.assetsPaise),
        sectionBlock('Liabilities', rows, 'LIABILITIES', 'Total liabilities', t.liabilitiesPaise),
        sectionBlock('Funds', rows, 'FUNDS', 'Total funds', t.fundsPaise),
        sectionBlock('Reserves and surplus', rows, 'RESERVES', 'Total reserves and surplus', t.reservesPaise),
      ].filter(b => b.rows.length > 0);
      const a = numN(t.assetsPaise);
      const l = numN(t.liabilitiesAndFundsPaise);
      if (a !== undefined) view.summary.push({ label: 'Total assets', value: inr(a) });
      if (l !== undefined) view.summary.push({ label: 'Liabilities, funds and surplus', value: inr(l) });
      view.empty = rows.length === 0;
      break;
    }
    case 'general-ledger': {
      const rows = arr(raw.rows);
      const acc = obj(pick(raw, 'ledgerAccount', 'account'));
      const opening = numN(pick(raw, 'openingPaise', 'openingBalancePaise'));
      if (acc.name) view.heading = `General ledger: ${str(acc.code)} ${str(acc.name)}`.replace('  ', ' ');
      view.blocks = [
        {
          title: null,
          columns: [
            { label: 'Date' },
            { label: 'Voucher' },
            { label: 'Narration' },
            { label: 'Debit', right: true },
            { label: 'Credit', right: true },
            { label: 'Balance', right: true },
          ],
          rows: rows.map(x => {
            const r = obj(x);
            const jid = numN(pick(r, 'entryId', 'journalId', 'journalEntryId'));
            return [
              text(shortDate(str(r.date))),
              text(str(r.voucherNo, '-'), jid ? { journalId: jid } : {}),
              text(str(r.narration)),
              dash(r.debitPaise),
              dash(r.creditPaise),
              money(pick(r, 'runningPaise', 'balancePaise')),
            ];
          }),
          total: null,
        },
      ];
      if (opening !== undefined) view.summary.push({ label: 'Opening balance', value: inr(opening) });
      const closing = numN(pick(raw, 'closingPaise', 'closingBalancePaise'));
      if (closing !== undefined) view.summary.push({ label: 'Closing balance', value: inr(closing) });
      view.empty = rows.length === 0;
      break;
    }
    case 'receipts-payments': {
      const rows = arr(raw.rows).map(obj);
      const t = obj(raw.totals);
      view.blocks = [
        sectionBlock('Receipts', rows, 'RECEIPT', 'Total receipts', t.receiptsPaise),
        sectionBlock('Payments', rows, 'PAYMENT', 'Total payments', t.paymentsPaise),
      ];
      const o = numN(t.openingPaise);
      const c = numN(t.closingPaise);
      if (o !== undefined) view.summary.push({ label: 'Cash and bank at the start', value: inr(o) });
      if (c !== undefined) view.summary.push({ label: 'Cash and bank at the end', value: inr(c) });
      view.empty = rows.length === 0;
      break;
    }
    case 'gst-summary': {
      const rows = arr(raw.rows);
      const t = obj(raw.totals);
      const cells = (r: R, bold = false): ReportCell[] => [
        dash(r.outputCgstPaise),
        dash(r.outputSgstPaise),
        dash(r.outputIgstPaise),
        dash(r.outputTotalPaise),
        dash(r.inputCreditPaise),
        money(r.netPayablePaise, true, bold),
      ];
      view.blocks = [
        {
          title: null,
          columns: [
            { label: 'Month' },
            { label: 'CGST collected', right: true },
            { label: 'SGST collected', right: true },
            { label: 'IGST collected', right: true },
            { label: 'GST collected (output)', right: true },
            { label: 'GST paid (input credit)', right: true },
            { label: 'Net payable', right: true },
          ],
          rows: rows.map(x => [text(str(obj(x).month)), ...cells(obj(x))]),
          total: rows.length ? [text('Total', { bold: true }), ...cells(t, true)] : null,
        },
      ];
      view.empty = rows.length === 0;
      break;
    }
    case 'tds-register': {
      const rows = arr(raw.rows);
      const t = obj(raw.totals);
      view.blocks = [
        {
          title: null,
          columns: [
            { label: 'Date' },
            { label: 'Voucher' },
            { label: 'Payee' },
            { label: 'Section' },
            { label: 'Deducted', right: true },
            { label: 'Deposited', right: true },
            { label: 'Challan' },
          ],
          rows: rows.map(x => {
            const r = obj(x);
            const jid = numN(pick(r, 'entryId', 'journalId', 'journalEntryId'));
            return [
              text(shortDate(str(r.date))),
              text(str(r.voucherNo, '-'), jid ? { journalId: jid } : {}),
              text(str(pick(r, 'payee', 'payeeName'), '-')),
              text(str(pick(r, 'tdsSection', 'section'), '-')),
              dash(r.deductedPaise),
              dash(r.depositedPaise),
              text(str(r.challanNo, '-')),
            ];
          }),
          total: rows.length
            ? [
                text('Total', { bold: true }),
                text(''),
                text(''),
                text(''),
                money(t.deductedPaise, true, true),
                money(t.depositedPaise, true, true),
                text(''),
              ]
            : null,
        },
      ];
      view.empty = rows.length === 0;
      break;
    }
  }
  return view;
}

/** Flattens the ledger account tree into leaf and group options for the account picker. */
export function flattenLedger(raw: unknown, out: LedgerOption[] = []): LedgerOption[] {
  for (const x of arr(raw)) {
    const r = obj(x);
    const id = num(r.id);
    if (id) out.push({ id, code: str(r.code), name: str(r.name), isGroup: r.isGroup === true });
    flattenLedger(r.children, out);
  }
  return out;
}

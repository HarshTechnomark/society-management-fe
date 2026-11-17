'use client';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useLoad } from '@/hooks/useLoad';
import { inr, shortDate } from '@/lib/money';
import { accountsStatementsService } from '@/services/accountsStatements.service';
import type { StatementLine } from '@/types/accountsStatements';
import { MATCH_METHOD_LABEL, bankError } from './format';
import { lineAmount, lineIsCredit } from './LineActions';

/** Book entries that could match the chosen statement line, with Match, Create entry, Ignore and Unmatch. */
export function CandidatePane({
  line,
  canWrite,
  locked,
  onChanged,
  onCreate,
  onIgnore,
}: {
  line: StatementLine;
  canWrite: boolean;
  /** The import is reconciled: nothing can change. */
  locked: boolean;
  onChanged: () => void;
  onCreate: () => void;
  onIgnore: () => void;
}) {
  const toast = useToast();
  const open = line.matchStatus === 'UNMATCHED';
  const cands = useLoad(
    () => (open ? accountsStatementsService.candidates(line.id) : Promise.resolve([])),
    `${line.id}|${open}`,
  );
  const [busy, setBusy] = useState<number | 'unmatch' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: number | 'unmatch', fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast.show(done);
      onChanged();
    } catch (e) {
      setError(bankError(e));
    } finally {
      setBusy(null);
    }
  };

  const scores = (cands.data ?? []).map(c => c.score);
  const tied = new Set(scores.filter((v, i) => scores.indexOf(v) !== i));

  return (
    <div className="grid min-w-0 gap-3" data-testid="candidate-pane">
      <div>
        <p className="text-[13px] text-muted">
          {shortDate(line.txnDate)} {lineIsCredit(line) ? 'money in' : 'money out'}
        </p>
        <p className="text-[18px] font-bold tabular-nums">{inr(lineAmount(line))}</p>
        <p className="break-words text-[14px]" title={line.description}>
          {line.description}
        </p>
        {line.reference && <p className="text-[13px] text-muted">Reference {line.reference}</p>}
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      {line.matchStatus === 'MATCHED' && (
        <div className="grid gap-2">
          <Alert tone="ok">
            {line.matchMethod ? MATCH_METHOD_LABEL[line.matchMethod] : 'Matched'}
            {line.matchedLabel ? `: ${line.matchedLabel}` : ''}
            {line.matchConfidence != null ? ` (${line.matchConfidence}% sure)` : ''}
          </Alert>
          {canWrite && !locked && (
            <Button
              variant="glass"
              loading={busy === 'unmatch'}
              onClick={() =>
                void run(
                  'unmatch',
                  () => accountsStatementsService.unmatch(line.id, line.version),
                  'Match undone.',
                )
              }
            >
              Unmatch
            </Button>
          )}
        </div>
      )}
      {line.matchStatus === 'IGNORED' && (
        <div className="grid gap-2">
          <Alert tone="info">Ignored: {line.ignoredReason ?? 'no reason given'}</Alert>
          {canWrite && !locked && (
            <Button
              variant="glass"
              loading={busy === 'unmatch'}
              onClick={() =>
                void run(
                  'unmatch',
                  () => accountsStatementsService.unmatch(line.id, line.version),
                  'Line is open again.',
                )
              }
            >
              Restore this line
            </Button>
          )}
        </div>
      )}
      {open && (
        <>
          <h3 className="text-[14px] font-bold">Entries in your books</h3>
          {cands.loading ? (
            <div className="skeleton h-14 w-full" data-testid="skeleton-row" />
          ) : cands.error ? (
            <Alert tone="bad">{bankError(cands.error)}</Alert>
          ) : (cands.data ?? []).length === 0 ? (
            <p className="text-[13.5px] text-muted">
              No matching entry found. Create one from this line or ignore it.
            </p>
          ) : (
            <ul aria-label="Candidate entries" className="divide-y divide-[var(--line)]">
              {cands.data!.map(c => (
                <li
                  key={c.journalLineId}
                  data-testid="candidate-row"
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0 text-[13.5px]">
                    <p className="font-semibold tabular-nums">
                      {inr(c.amountPaise)}{' '}
                      <span className="font-normal text-muted">{shortDate(c.entryDate)}</span>
                    </p>
                    <p className="truncate" title={c.narration || c.voucherNo || ''}>
                      {c.narration || c.voucherNo}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {c.voucherNo ? `${c.voucherNo}. ` : ''}
                      {c.instrumentRef ? `Ref ${c.instrumentRef}. ` : ''}Possible match, {c.score}%
                      {tied.has(c.score)
                        ? '. Another entry scores the same: check the date and narration.'
                        : ''}
                    </p>
                  </div>
                  {canWrite && !locked && (
                    <Button
                      size="sm"
                      loading={busy === c.journalLineId}
                      onClick={() =>
                        void run(
                          c.journalLineId,
                          () =>
                            accountsStatementsService.match(line.id, {
                              journalLineId: c.journalLineId,
                              version: line.version,
                            }),
                          'Matched.',
                        )
                      }
                    >
                      Match
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && !locked && (
            <div className="flex flex-wrap gap-2">
              <Button variant="glass" onClick={onCreate}>
                Create entry from line
              </Button>
              <Button variant="ghost" onClick={onIgnore}>
                Ignore
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

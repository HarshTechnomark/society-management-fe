'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ListBody, NoRows } from '@/components/payments/ops/Bits';
import { Segments } from '@/components/residents/common';
import { Gate } from '@/components/setup/Gate';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { inr, shortDate } from '@/lib/money';
import { accountsDepositsService as svc } from '@/services/accountsDeposits.service';
import type { Deposit } from '@/types/accountsDeposits';
import { DepositDrawer } from './DepositDrawer';
import { NewDepositDialog } from './DepositDialogs';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE } from './format';

const P = PERMISSIONS.finance.accounts;
const SEGMENTS = [
  { key: '', label: 'All' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { key: 'HELD', label: 'Held' },
  { key: 'REFUND_PENDING', label: 'Refund pending' },
  { key: 'REFUND_APPROVED', label: 'Refund approved' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: 'FORFEITED', label: 'Forfeited' },
];

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-4" data-testid="deposit-tile">
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Money > Deposits (spec 11.6): segments, filters, three tiles, new deposit and the detail drawer. */
export function DepositsScreen() {
  return (
    <Gate view={P.view} title="Deposits">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canAct = usePermission(P.create);
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Deposit | null>(null);
  const load = useLoad(
    () =>
      svc.list({
        status: status || undefined,
        kind: kind || undefined,
        q: q.trim() || undefined,
        page,
        limit: 20,
      }),
    `${status}|${kind}|${q.trim()}|${page}`,
  );
  const sum = useLoad(() => svc.summary(), 'summary');
  const filtered = !!(status || kind || q.trim());
  const reload = () => {
    load.reload();
    sum.reload();
  };
  const reset = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setPage(1);
  };

  return (
    <Page>
      <PageHead
        title="Deposits"
        sub="Refundable deposits the society holds for flats: renovation, move-in, access cards and more."
        actions={canAct && <Button onClick={() => setAdding(true)}>New deposit</Button>}
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[600px]:grid-cols-3">
        <Tile label="Held now" value={sum.data ? inr(sum.data.heldPaise) : '-'} />
        <Tile label="Refunded" value={sum.data ? inr(sum.data.refundedPaise) : '-'} />
        <Tile label="Forfeited" value={sum.data ? inr(sum.data.forfeitedPaise) : '-'} />
      </div>
      <Card>
        <Segments label="Deposit status" options={SEGMENTS} value={status} onChange={reset(setStatus)} />
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Select
            label="Type"
            value={kind}
            onChange={e => reset(setKind)(e.target.value)}
            options={[
              { value: '', label: 'All types' },
              ...Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
          <Input
            label="Search"
            placeholder="Flat or DEP-12"
            value={q}
            onChange={e => reset(setQ)(e.target.value)}
          />
        </div>
        <ListBody
          load={load}
          label="Deposits"
          page={page}
          onPage={setPage}
          empty={
            <NoRows
              title={filtered ? 'No deposits match' : 'No deposits yet'}
              text={filtered ? 'Change the filters.' : 'Deposits you add appear here.'}
            />
          }
        >
          {items =>
            items.map(d => (
              <li
                key={d.id}
                data-testid="deposit-row"
                className="grid gap-x-3 gap-y-1 py-3 min-[900px]:grid-cols-[6rem_6rem_1fr_8rem_8rem_8rem_11rem] min-[900px]:items-center"
              >
                <button
                  type="button"
                  className="text-left text-[14.5px] font-bold underline-offset-2 hover:underline"
                  onClick={() => setViewing(d)}
                  aria-label={`Details of ${d.code}`}
                >
                  {d.code}
                </button>
                <span className="text-[14px]">{d.unitLabel}</span>
                <span className="text-[13.5px] text-muted">{KIND_LABEL[d.kind] ?? d.kind}</span>
                <span className="text-[14px] font-semibold tabular-nums">{inr(d.amountPaise)}</span>
                <span className="text-[13.5px] tabular-nums" title="Received">
                  {d.receivedAt ? shortDate(d.receivedAt) : inr(d.receivedPaise)}
                </span>
                <span className="text-[13.5px] tabular-nums" title="Held">
                  Held {inr(d.heldPaise)}
                </span>
                <span>
                  <Chip tone={STATUS_TONE[d.status] ?? 'neutral'}>{STATUS_LABEL[d.status] ?? d.status}</Chip>
                </span>
              </li>
            ))
          }
        </ListBody>
      </Card>
      {adding && <NewDepositDialog onClose={() => setAdding(false)} onDone={reload} />}
      {viewing && (
        <DepositDrawer
          deposit={viewing}
          canAct={canAct}
          onClose={() => setViewing(null)}
          onChanged={reload}
        />
      )}
    </Page>
  );
}

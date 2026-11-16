'use client';
import { useState } from 'react';
import { CheckoutOptions } from '@/components/payments/CheckoutOptions';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { ApiError } from '@/lib/apiClient';
import { inr, shortDate } from '@/lib/money';
import { billingResidentService } from '@/services/billingResident.service';
import { paymentsResidentService as svc } from '@/services/paymentsResident.service';
import type { Mandate, MandateCreated } from '@/types/paymentsResident';
import { PayTabs } from './PayTabs';
import { payError, plainPayError, rupeesToPaise } from './format';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING_AUTH: { label: 'Waiting for your approval', tone: 'warn' },
  ACTIVE: { label: 'On', tone: 'ok' },
  PAUSED: { label: 'Paused', tone: 'warn' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'bad' },
};
const LIVE = new Set(['PENDING_AUTH', 'ACTIVE', 'PAUSED']);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => iso(new Date(Date.now() + n * 86_400_000));

export function notAvailable(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 'AUTOPAY_NOT_AVAILABLE' || e.code === 'FEATURE_NOT_IN_PLAN');
}

/** AutoPay (only when the society has it): set up with a cap, start and end; authorise; pause, resume, cancel. */
export function AutoPayScreen() {
  return (
    <Gate view={PERMISSIONS.resident.payments.view} title="AutoPay">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const toast = useToast();
  const list = useLoad(() => svc.mandates(), 'mandates');
  const dues = useLoad(() => billingResidentService.dues(), 'dues');
  const [cancelling, setCancelling] = useState<Mandate | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [auth, setAuth] = useState<MandateCreated | null>(null);

  const act = async (m: Mandate, kind: 'pause' | 'resume') => {
    setBusy(m.id);
    setProblem(null);
    try {
      await (kind === 'pause' ? svc.pauseMandate(m.id, m.version) : svc.resumeMandate(m.id, m.version));
      toast.show(kind === 'pause' ? 'AutoPay paused.' : 'AutoPay is on again.');
      list.reload();
    } catch (e) {
      setProblem(payError(e));
      if (e instanceof ApiError && e.code === 'STALE_VERSION') list.reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <PageHead
        title="AutoPay"
        sub="Let your bank pay your maintenance bill by itself, up to a cap you choose."
      />
      <PayTabs />
      {list.error != null ? (
        <Card>
          {notAvailable(list.error) ? (
            <EmptyState title="AutoPay is not available" text="Your society does not offer AutoPay yet." />
          ) : (
            <ErrorState
              error={plainPayError(list.error)}
              action={
                <Button size="sm" onClick={list.reload}>
                  Try again
                </Button>
              }
            />
          )}
        </Card>
      ) : list.loading ? (
        <div aria-busy="true" aria-label="Loading AutoPay">
          <div className="skeleton h-24 w-full" data-testid="skeleton-row" />
        </div>
      ) : (
        <>
          {problem && (
            <Alert tone="bad" className="mb-3">
              {problem}
            </Alert>
          )}
          {auth && (
            <Card title="Approve in your bank app" className="mb-4">
              <p className="mb-3 text-[14px]">
                AutoPay starts after you approve it in your UPI or bank app. The request is valid for 48
                hours.
              </p>
              <CheckoutOptions
                checkout={{
                  provider: '',
                  gatewayOrderId: '',
                  keyId: null,
                  name: '',
                  description: '',
                  methods: [],
                  upiIntentUrl: auth.upiIntentUrl,
                  qrPayload: auth.qrPayload,
                  redirectUrl: auth.redirectUrl,
                  isFake: !auth.upiIntentUrl && !auth.qrPayload && !auth.redirectUrl,
                  raw: {},
                }}
                expiresAt={auth.expiresAt}
              />
              {!auth.upiIntentUrl && !auth.qrPayload && !auth.redirectUrl && (
                <p className="text-[13.5px] text-muted">Approval is waiting in your bank app.</p>
              )}
              <Button className="mt-3" variant="glass" onClick={() => setAuth(null)}>
                Done
              </Button>
            </Card>
          )}
          {(list.data ?? []).length > 0 && (
            <ul aria-label="My AutoPay" className="mb-4 grid gap-3">
              {(list.data ?? []).map(m => {
                const st = STATUS[m.status] ?? { label: m.status, tone: 'neutral' as Tone };
                return (
                  <li key={m.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <h2 className="text-[17px] font-bold">{m.unitLabel}</h2>
                        <Chip tone={st.tone}>{st.label}</Chip>
                      </div>
                      <p className="mt-1 text-[14px]">
                        Up to <strong>{inr(m.maxAmountPaise)}</strong> per bill · {shortDate(m.startDate)} to{' '}
                        {shortDate(m.endDate)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="glass"
                            loading={busy === m.id}
                            onClick={() => act(m, 'pause')}
                          >
                            Pause
                          </Button>
                        )}
                        {m.status === 'PAUSED' && (
                          <Button
                            size="sm"
                            variant="glass"
                            loading={busy === m.id}
                            onClick={() => act(m, 'resume')}
                          >
                            Resume
                          </Button>
                        )}
                        {LIVE.has(m.status) && (
                          <Button size="sm" variant="danger-soft" onClick={() => setCancelling(m)}>
                            Cancel AutoPay
                          </Button>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          <SetupForm
            units={(dues.data ?? []).map(u => ({ id: u.unitId, label: u.unitLabel }))}
            blocked={new Set((list.data ?? []).filter(m => LIVE.has(m.status)).map(m => m.unitId))}
            onCreated={c => {
              setAuth(c);
              list.reload();
            }}
          />
        </>
      )}
      <ConfirmReason
        open={cancelling !== null}
        title="Cancel AutoPay"
        description="Your bank stops paying your bills by itself. You can set it up again later."
        confirmLabel="Cancel AutoPay"
        minLength={0}
        onCancel={() => setCancelling(null)}
        onConfirm={async reason => {
          const m = cancelling;
          if (!m) return;
          try {
            await svc.cancelMandate(m.id, m.version, reason.trim() || undefined);
            toast.show('AutoPay cancelled.');
            setCancelling(null);
            list.reload();
          } catch (e) {
            setCancelling(null);
            setProblem(payError(e));
          }
        }}
      />
    </Page>
  );
}

function SetupForm({
  units,
  blocked,
  onCreated,
}: {
  units: { id: number; label: string }[];
  blocked: Set<number>;
  onCreated: (c: MandateCreated) => void;
}) {
  const free = units.filter(u => !blocked.has(u.id));
  const [unit, setUnit] = useState('');
  const [type, setType] = useState<'UPI_AUTOPAY' | 'ENACH'>('UPI_AUTOPAY');
  const [cap, setCap] = useState('');
  const [start, setStart] = useState(plusDays(1));
  const [end, setEnd] = useState(plusDays(365));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const unitId = Number(unit || free[0]?.id || 0);

  if (free.length === 0) return null;
  const submit = async () => {
    const paise = rupeesToPaise(cap);
    const e: Record<string, string> = {};
    if (paise === null || paise < 100) e.cap = 'Enter the most that may be paid at one time.';
    if (!start) e.start = 'Choose a start date.';
    if (!end || end <= start) e.end = 'The end date must be after the start date.';
    setErrors(e);
    if (Object.keys(e).length > 0 || paise === null) return;
    setBusy(true);
    setProblem(null);
    try {
      onCreated(
        await svc.createMandate({
          unitId,
          mandateType: type,
          maxAmountPaise: paise,
          startDate: start,
          endDate: end,
        }),
      );
    } catch (err) {
      setProblem(payError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Set up AutoPay">
      {problem && (
        <Alert tone="bad" className="mb-3">
          {problem}
        </Alert>
      )}
      <div className="grid gap-x-4 sm:grid-cols-2">
        {free.length > 1 && (
          <Select
            label="Flat"
            value={String(unitId)}
            onChange={e => setUnit(e.target.value)}
            options={free.map(u => ({ value: String(u.id), label: u.label }))}
          />
        )}
        <Select
          label="How"
          value={type}
          onChange={e => setType(e.target.value as 'UPI_AUTOPAY' | 'ENACH')}
          options={[
            { value: 'UPI_AUTOPAY', label: 'UPI AutoPay' },
            { value: 'ENACH', label: 'Bank e-mandate' },
          ]}
        />
        <Input
          label="Cap per payment (₹)"
          inputMode="decimal"
          hint="Nothing above this is ever paid in one go."
          value={cap}
          onChange={e => setCap(e.target.value)}
          error={errors.cap}
        />
        <Input
          label="Start date"
          type="date"
          min={plusDays(0)}
          max={plusDays(60)}
          value={start}
          onChange={e => setStart(e.target.value)}
          error={errors.start}
        />
        <Input
          label="End date"
          type="date"
          value={end}
          onChange={e => setEnd(e.target.value)}
          error={errors.end}
        />
      </div>
      <Button loading={busy} onClick={submit}>
        Authorise AutoPay
      </Button>
    </Card>
  );
}

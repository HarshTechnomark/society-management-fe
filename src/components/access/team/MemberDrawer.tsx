'use client';
import { useMemo, useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Chip, type Tone } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { accessControlService } from '@/services/access-control.service';
import type { Grant, MemberDetail } from '@/types/accessControl';
import { accessErrorText, fmtDate, fmtDateTime, lastSeen } from '../format';

const clock = () => Date.now();

export function grantState(g: Grant): { label: string; tone: Tone } {
  if (g.status === 'REVOKED') return { label: 'Revoked', tone: 'neutral' };
  if (g.status === 'EXPIRED' || (g.endsAt && Date.parse(g.endsAt) <= clock()))
    return { label: 'Expired', tone: 'neutral' };
  if (Date.parse(g.startsAt) > clock()) return { label: 'Scheduled', tone: 'info' };
  return { label: 'Active', tone: 'ok' };
}

const STATUS_TONE: Record<string, Tone> = { ACTIVE: 'ok', SUSPENDED: 'warn', ENDED: 'neutral' };

/** Spec 11.5: member detail drawer. */
export function MemberDrawer({
  memberId,
  onClose,
  onChanged,
}: {
  memberId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Drawer open={memberId !== null} onClose={onClose} title="Member details" size={640}>
      {memberId !== null && <Body key={memberId} memberId={memberId} onChanged={onChanged} />}
    </Drawer>
  );
}

function Body({ memberId, onChanged }: { memberId: number; onChanged: () => void }) {
  const detail = useLoad(() => accessControlService.member(memberId));
  const toast = useToast();
  const canEdit = usePermission(PERMISSIONS.settings.members.edit);
  const [revoking, setRevoking] = useState<Grant | null>(null);

  if (detail.loading && !detail.data)
    return (
      <div className="flex flex-col gap-3" data-testid="drawer-loading">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    );
  if (detail.error || !detail.data) return <ErrorState error={detail.error} />;
  const m = detail.data;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="md-profile">
        <h3 id="md-profile" className="mb-2 text-[15px] font-bold">
          Profile
        </h3>
        <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[14px]">
          <dt className="text-muted">Name</dt>
          <dd className="font-semibold">
            {m.name} {m.isSelf && <Chip tone="gold">You</Chip>}
          </dd>
          <dt className="text-muted">Mobile</dt>
          <dd>{m.mobile ?? 'Not shared'}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="break-all">{m.email ?? 'None'}</dd>
          <dt className="text-muted">Two-step</dt>
          <dd>{m.mfaEnabled ? 'On' : m.requiresMfa ? 'Not yet (required)' : 'Not yet'}</dd>
          <dt className="text-muted">Last sign in</dt>
          <dd>{lastSeen(m.lastLoginAt)}</dd>
        </dl>
      </section>

      <section aria-labelledby="md-role">
        <h3 id="md-role" className="mb-2 text-[15px] font-bold">
          Role and status
        </h3>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Chip tone="gold">{m.role.name}</Chip>
          <Chip tone={STATUS_TONE[m.status] ?? 'neutral'}>
            {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
          </Chip>
          <span className="text-[13px] text-muted">{m.effectivePermissionCount} permissions in effect</span>
        </div>
        <p className="text-[13.5px] text-muted">Joined {fmtDate(m.joinedAt) || 'n/a'}</p>
        {m.suspendedAt && (
          <p className="text-[13.5px]">
            Suspended on {fmtDate(m.suspendedAt)}
            {m.suspendReason ? `: ${m.suspendReason}` : ''}
          </p>
        )}
        {m.endedAt && (
          <p className="text-[13.5px]">
            Ended on {fmtDate(m.endedAt)}
            {m.endReason ? `: ${m.endReason}` : ''}
          </p>
        )}
      </section>

      <section aria-labelledby="md-flats">
        <h3 id="md-flats" className="mb-2 text-[15px] font-bold">
          Flats
        </h3>
        {m.unitLinks.length ? (
          <ul className="text-[14px]">
            {m.unitLinks.map(u => (
              <li key={u.unitId}>
                {u.unitLabel} <span className="text-muted">({u.relation.toLowerCase()})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-muted">{m.locationLabel ?? 'No flat linked.'}</p>
        )}
      </section>

      <section aria-labelledby="md-grants">
        <h3 id="md-grants" className="mb-1 text-[15px] font-bold">
          Extra permissions
        </h3>
        <p className="mb-2 text-[13px] text-muted">
          Time-bound permissions on top of the role. Maximum 90 days each.
        </p>
        {m.grants.length === 0 && <p className="text-[14px] text-muted">None.</p>}
        <ul className="flex flex-col gap-2">
          {m.grants.map(g => {
            const st = grantState(g);
            return (
              <li key={g.id} className="rounded-[14px] border border-[var(--line)] bg-white/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{g.label}</span>
                  <Chip tone={st.tone}>{st.label}</Chip>
                </div>
                <p className="text-[12.5px] text-muted">
                  <code>{g.permissionKey}</code>
                </p>
                <p className="text-[13px]">
                  {fmtDateTime(g.startsAt)} to {fmtDateTime(g.endsAt)}
                  {g.grantedByName ? `, by ${g.grantedByName}` : ''}
                </p>
                {g.reason && <p className="text-[13px] text-muted">{g.reason}</p>}
                {canEdit && !m.isSelf && g.status === 'ACTIVE' && st.label !== 'Expired' && (
                  <Button size="xs" variant="danger-soft" className="mt-2" onClick={() => setRevoking(g)}>
                    Revoke
                    <span className="sr-only"> {g.label}</span>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {canEdit && !m.isSelf && m.status === 'ACTIVE' && (
          <AddGrant
            member={m}
            onAdded={() => {
              toast.show('Extra permission added.');
              detail.reload();
              onChanged();
            }}
          />
        )}
      </section>

      <section aria-labelledby="md-inv">
        <h3 id="md-inv" className="mb-2 text-[15px] font-bold">
          Invitation history
        </h3>
        {m.invitation ? (
          <p className="text-[14px]">
            Invited by {m.invitation.invitedByName}
            {m.invitation.respondedAt ? `, accepted on ${fmtDate(m.invitation.respondedAt)}` : ''}.
          </p>
        ) : (
          <p className="text-[14px] text-muted">Added without an invitation.</p>
        )}
      </section>

      <ConfirmReason
        open={!!revoking}
        title={`Revoke ${revoking?.label ?? 'permission'}?`}
        description="The member loses this permission now."
        confirmLabel="Revoke"
        onCancel={() => setRevoking(null)}
        onConfirm={async reason => {
          try {
            await accessControlService.revokeGrant(m.id, revoking!.id, reason);
            toast.show('Permission revoked.');
            setRevoking(null);
            detail.reload();
            onChanged();
          } catch (e) {
            toast.show(accessErrorText(e), 'error');
          }
        }}
      />
    </div>
  );
}

function AddGrant({ member, onAdded }: { member: MemberDetail; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="glass" className="mt-3" onClick={() => setOpen(true)}>
        Add permission
      </Button>
    );
  return (
    <AddGrantForm
      member={member}
      onCancel={() => setOpen(false)}
      onAdded={() => {
        setOpen(false);
        onAdded();
      }}
    />
  );
}

function AddGrantForm({
  member,
  onAdded,
  onCancel,
}: {
  member: MemberDetail;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const catalogue = useLoad(() => accessControlService.catalogue('society'));
  const role = useLoad(() => accessControlService.role(member.role.id));
  const [key, setKey] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(() => {
    const held = catalogue.data?.masters.flatMap(m => m.subMasters.flatMap(s => s.permissions)) ?? [];
    const inRole = new Set(role.data?.permissionKeys ?? []);
    const skip = new Set(member.grants.filter(g => g.status === 'ACTIVE').map(g => g.permissionKey));
    return held.filter(p => p.heldByMe && !inRole.has(p.key) && !skip.has(p.key));
  }, [catalogue.data, role.data, member.grants]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!key) e.key = 'Pick a permission.';
    if (!end) e.end = 'Pick when it ends.';
    else if (start && Date.parse(end) <= Date.parse(start)) e.end = 'The end must be after the start.';
    else if (Date.parse(end) <= clock()) e.end = 'The end must be in the future.';
    const r = reason.trim();
    if (r.length < 5 || r.length > 300) e.reason = 'Enter between 5 and 300 characters.';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await accessControlService.addGrant(member.id, {
        permissionKey: key,
        ...(start ? { startsAt: new Date(start).toISOString() } : {}),
        endsAt: new Date(end).toISOString(),
        reason: r,
      });
      onAdded();
    } catch (err) {
      setFormError(accessErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="mt-3 rounded-[16px] border border-[var(--line)] bg-white/50 p-4"
      aria-label="Add permission"
      onSubmit={e => {
        e.preventDefault();
        void submit();
      }}
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <Select
        label="Permission"
        value={key}
        onChange={e => setKey(e.target.value)}
        error={errors.key}
        hint={
          catalogue.loading
            ? 'Loading the permissions you can give.'
            : 'Only permissions you hold yourself are listed.'
        }
        options={[
          { value: '', label: 'Select a permission' },
          ...options.map(o => ({ value: o.key, label: o.label })),
        ]}
      />
      <Input
        label="Starts (optional, default now)"
        type="datetime-local"
        value={start}
        onChange={e => setStart(e.target.value)}
      />
      <Input
        label="Ends"
        type="datetime-local"
        value={end}
        onChange={e => setEnd(e.target.value)}
        error={errors.end}
        required
      />
      <Input
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        error={errors.reason}
        required
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="submit" loading={busy}>
          Add permission
        </Button>
      </div>
    </form>
  );
}

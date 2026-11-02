'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusChip } from '@/components/societies/bits';
import { isValidSlug, slugify } from '@/components/societies/format';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { OrgStatus, Organization } from '@/types/platformOps';
import { OrgStatusChip, opsError } from '../format';

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Spec 11.9 drawer; `id` null creates an organization. */
export function OrganizationDrawer({
  id,
  onClose,
  onChanged,
}: {
  id: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const canCreate = usePermission(PERMISSIONS.platform.societies.create);
  const canEdit = usePermission(PERMISSIONS.platform.societies.edit);
  const canClose = usePermission(PERMISSIONS.platform.societies.delete);
  const [org, setOrg] = useState<Organization | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [gstin, setGstin] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusTo, setStatusTo] = useState<OrgStatus | null>(null);

  const apply = (o: Organization) => {
    setOrg(o);
    setName(o.name);
    setGstin(o.gstin ?? '');
    setEmail(o.contactEmail ?? '');
    setMobile('');
  };
  useEffect(() => {
    if (id === null) return;
    let live = true;
    svc.organization(id).then(
      o => live && apply(o),
      e => live && setError(e),
    );
    return () => {
      live = false;
    };
  }, [id]);

  const editable = id === null ? canCreate : canEdit && org?.status !== 'CLOSED';

  const save = async () => {
    setProblem(null);
    if (name.trim().length < 2) return setProblem('Enter a name of at least 2 characters.');
    if (id === null && !isValidSlug(slug))
      return setProblem('The web address needs 3 to 60 letters, digits or hyphens.');
    if (gstin.trim() && !GSTIN.test(gstin.trim().toUpperCase()))
      return setProblem('That GSTIN does not look right.');
    if (mobile.trim() && !/^[6-9]\d{9}$/.test(mobile.trim()))
      return setProblem('Enter a 10 digit mobile number.');
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : null,
        contactEmail: email.trim() ? email.trim() : null,
        ...(mobile.trim() ? { contactMobile: mobile.trim() } : {}),
      };
      if (id === null) {
        await svc.createOrganization({ ...body, slug });
        toast.show('Organization created.');
        onChanged();
        onClose();
      } else {
        apply(await svc.updateOrganization(id, body));
        toast.show('Organization saved.');
        onChanged();
      }
    } catch (e) {
      setProblem(opsError(e));
    } finally {
      setBusy(false);
    }
  };

  const verb: Record<OrgStatus, string> = { ACTIVE: 'Reactivate', SUSPENDED: 'Suspend', CLOSED: 'Close' };
  return (
    <Drawer
      open
      onClose={onClose}
      title={id === null ? 'Add organization' : (org?.name ?? 'Organization')}
      footer={
        editable ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button loading={busy} onClick={save}>
              {id === null ? 'Create' : 'Save'}
            </Button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <ErrorState error={error} />
      ) : id !== null && !org ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          {problem && <Alert tone="bad">{problem}</Alert>}
          {org && (
            <div className="mb-3 flex items-center gap-2">
              <OrgStatusChip status={org.status} />
              <span className="text-[13px] text-muted">
                {org.societyCount} societies · {org.slug}
              </span>
            </div>
          )}
          <Input
            label="Name"
            disabled={!editable}
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (id === null && !slugTouched) setSlug(slugify(e.target.value));
            }}
          />
          {id === null && (
            <Input
              label="Web address"
              hint="Lowercase letters, digits and hyphens. Cannot be changed later."
              value={slug}
              onChange={e => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          )}
          <Input label="GSTIN" disabled={!editable} value={gstin} onChange={e => setGstin(e.target.value)} />
          <Input
            label="Contact email"
            type="email"
            disabled={!editable}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            label="Contact mobile"
            inputMode="numeric"
            hint={
              org?.contactMobileMasked
                ? `Saved: ${org.contactMobileMasked}. Type a new number to replace it.`
                : undefined
            }
            disabled={!editable}
            value={mobile}
            onChange={e => setMobile(e.target.value)}
          />
          {org && (
            <>
              <h3 className="mb-2 mt-4 text-[14px] font-bold">Linked societies</h3>
              {(org.societies ?? []).length === 0 ? (
                <p className="text-[13.5px] text-muted">No societies linked yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {org.societies!.map(s => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/platform/societies/${s.id}`} className="font-semibold hover:underline">
                        {s.name}
                      </Link>
                      <StatusChip status={s.status as never} />
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && org.status !== 'CLOSED' && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {org.status === 'ACTIVE' ? (
                    <Button variant="glass" size="sm" onClick={() => setStatusTo('SUSPENDED')}>
                      Suspend
                    </Button>
                  ) : (
                    <Button variant="glass" size="sm" onClick={() => setStatusTo('ACTIVE')}>
                      Reactivate
                    </Button>
                  )}
                  {canClose && (
                    <Button variant="danger-soft" size="sm" onClick={() => setStatusTo('CLOSED')}>
                      Close
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      <ConfirmReason
        open={statusTo !== null && org !== null}
        title={statusTo ? `${verb[statusTo]} ${org?.name}?` : ''}
        confirmLabel={statusTo ? verb[statusTo] : 'Confirm'}
        variant={statusTo === 'ACTIVE' ? 'primary' : 'danger'}
        onCancel={() => setStatusTo(null)}
        onConfirm={async reason => {
          if (!statusTo || !org) return;
          try {
            await svc.setOrganizationStatus(org.id, { status: statusTo, reason });
            toast.show('Status changed.');
            setStatusTo(null);
            apply(await svc.organization(org.id));
            onChanged();
          } catch (e) {
            setStatusTo(null);
            setProblem(opsError(e));
          }
        }}
      />
    </Drawer>
  );
}

'use client';
import { useState } from 'react';
import { ConfirmReason } from '@/components/common/ConfirmReason';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { shortDate } from '@/lib/money';
import { isValidEmail, isValidMobile, normaliseMobile } from '@/lib/validation';
import { residentsService } from '@/services/residents.service';
import type { DocType, ResidentDetail, ResidentDocument, ResidentLink } from '@/types/residents';
import { FileField, FormDialog, KV, Loading, Section, StatusChip, isoDate, useRun } from './common';
import {
  FAMILY_LABEL,
  KYC_LABEL,
  KYC_TONE,
  RELATION_LABEL,
  VERIFY_LABEL,
  VERIFY_TONE,
  docLabel,
  today,
} from './format';

const P = PERMISSIONS.residents;
const UPLOAD_TYPES: DocType[] = [
  'AADHAAR',
  'PAN',
  'PASSPORT',
  'DRIVING_LICENCE',
  'VOTER_ID',
  'OTHER_ID',
  'ADDRESS_PROOF',
  'NOC',
  'OTHER',
];
const END_REASONS = [
  ['MOVED_OUT', 'Moved out'],
  ['SOLD', 'Sold'],
  ['TRANSFERRED', 'Transferred'],
  ['DECEASED', 'Deceased'],
  ['CORRECTION', 'Entered by mistake'],
  ['REMOVED', 'Removed'],
  ['OTHER', 'Other'],
];

/** The person drawer of the People tab (spec 11.1): profile, links, documents, invite and delete. */
export function ResidentDrawer({
  residentId,
  onClose,
  onChanged,
}: {
  residentId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canEdit = usePermission(P.people.edit);
  const canCreate = usePermission(P.people.create);
  const canDelete = usePermission(P.people.delete);
  const canApprove = usePermission(P.people.approve);
  const canReveal = usePermission(P.contacts.view);
  const kycOn = useFeature('residents.kyc_vault');
  const inviteOn = useFeature('residents.invitation_and_self_registration');
  const run = useRun();
  const [reveal, setReveal] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: 'edit' }
    | { kind: 'delete' }
    | { kind: 'upload' }
    | { kind: 'end'; link: ResidentLink }
    | { kind: 'link'; link: ResidentLink }
    | { kind: 'reject'; doc: ResidentDocument }
    | { kind: 'remove'; doc: ResidentDocument }
    | null
  >(null);
  const load = useLoad(() => residentsService.resident(residentId, reveal), `${residentId}|${reveal}`);
  const done = () => {
    setDialog(null);
    load.reload();
    onChanged();
  };

  return (
    <Drawer open onClose={onClose} title={load.data?.name ?? 'Resident'} size={640}>
      <Loading load={load} rows={4}>
        {r => (
          <>
            <div className="mb-4 flex flex-wrap gap-1.5">
              <Chip tone={r.status === 'ACTIVE' ? 'ok' : 'neutral'}>
                {r.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </Chip>
              <Chip tone={r.hasLogin ? 'info' : 'neutral'}>
                {r.hasLogin ? 'Has app login' : 'No app login'}
              </Chip>
              {r.isMinor && <Chip>Minor</Chip>}
              <StatusChip status={r.kycStatus} labels={KYC_LABEL} tones={KYC_TONE} />
              <Chip tone={r.emergencyProfile.exists ? 'ok' : 'neutral'}>
                {r.emergencyProfile.exists ? 'Emergency profile saved' : 'No emergency profile'}
                {r.emergencyProfile.hasCareFlags ? ' · care flags' : ''}
              </Chip>
            </div>

            <Section
              title="Profile"
              action={
                <div className="flex gap-1.5">
                  {canReveal && !reveal && (
                    <Button size="xs" variant="glass" onClick={() => setReveal(true)}>
                      Reveal contacts
                    </Button>
                  )}
                  {canEdit && (
                    <Button size="xs" variant="glass" onClick={() => setDialog({ kind: 'edit' })}>
                      Edit
                    </Button>
                  )}
                </div>
              }
            >
              <dl>
                <KV label="Mobile">{r.mobile ?? '-'}</KV>
                <KV label="Email">{r.email ?? '-'}</KV>
                {r.dateOfBirth && <KV label="Date of birth">{shortDate(r.dateOfBirth)}</KV>}
                {r.adminNote && <KV label="Note">{r.adminNote}</KV>}
              </dl>
              {canCreate && inviteOn && r.mobile && !r.hasLogin && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    if (await run(() => residentsService.invite(r.id), 'Invite sent')) {
                      load.reload();
                      onChanged();
                    }
                  }}
                >
                  Send invite
                </Button>
              )}
            </Section>

            <Section title="Flats">
              {r.links.length === 0 && <p className="text-[14px] text-muted">Not linked to any flat.</p>}
              <ul>
                {r.links.map(l => (
                  <li
                    key={l.linkId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2 text-[14px]"
                  >
                    <span>
                      <strong>{l.unitLabel}</strong>{' '}
                      <span className="text-muted">
                        {l.relation === 'FAMILY' && l.familyRelation
                          ? FAMILY_LABEL[l.familyRelation]
                          : RELATION_LABEL[l.relation]}
                        {l.sharePercent ? ` · ${l.sharePercent}%` : ''} · from {shortDate(l.fromDate)}
                        {l.toDate ? ` to ${shortDate(l.toDate)}` : ''}
                      </span>
                      {l.isPrimary && (
                        <Chip tone="gold" className="ml-1.5">
                          Primary
                        </Chip>
                      )}
                    </span>
                    {canEdit && !l.toDate && (
                      <span className="flex gap-1.5">
                        {(l.relation === 'OWNER' || l.relation === 'CO_OWNER') && (
                          <Button
                            size="xs"
                            variant="glass"
                            onClick={() => setDialog({ kind: 'link', link: l })}
                          >
                            Edit link
                          </Button>
                        )}
                        {l.relation !== 'TENANT' && (
                          <Button
                            size="xs"
                            variant="danger-soft"
                            onClick={() => setDialog({ kind: 'end', link: l })}
                          >
                            End link
                          </Button>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            {kycOn && (
              <Section
                title="Documents"
                action={
                  canCreate && (
                    <Button size="xs" variant="glass" onClick={() => setDialog({ kind: 'upload' })}>
                      Upload
                    </Button>
                  )
                }
              >
                {r.documents.length === 0 && <p className="text-[14px] text-muted">No documents uploaded.</p>}
                <ul>
                  {r.documents.map(d => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] py-2 text-[14px]"
                    >
                      <span>
                        {docLabel(d.docType)}
                        {d.idLast4 ? ` ····${d.idLast4}` : ''}{' '}
                        <StatusChip status={d.verificationStatus} labels={VERIFY_LABEL} tones={VERIFY_TONE} />
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {canApprove && d.verificationStatus === 'PENDING' && (
                          <>
                            <Button
                              size="xs"
                              onClick={async () => {
                                if (
                                  await run(
                                    () =>
                                      residentsService.verifyDocument(d.id, {
                                        decision: 'VERIFIED',
                                        version: d.version ?? 1,
                                      }),
                                    'Document verified',
                                  )
                                )
                                  done();
                              }}
                            >
                              Verify
                            </Button>
                            <Button
                              size="xs"
                              variant="danger-soft"
                              onClick={() => setDialog({ kind: 'reject', doc: d })}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {canReveal && (
                          <Button
                            size="xs"
                            variant="glass"
                            onClick={async () => {
                              await run(async () => {
                                const u = await residentsService.documentUrl(d.id);
                                window.open(u.url, '_blank', 'noopener');
                              });
                            }}
                          >
                            Download
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setDialog({ kind: 'remove', doc: d })}
                          >
                            Remove
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {canDelete && (
              <Button variant="danger-soft" onClick={() => setDialog({ kind: 'delete' })}>
                Delete person
              </Button>
            )}

            {dialog?.kind === 'edit' && <EditDialog r={r} onClose={() => setDialog(null)} onDone={done} />}
            {dialog?.kind === 'upload' && (
              <UploadDialog residentId={r.id} onClose={() => setDialog(null)} onDone={done} />
            )}
            {dialog?.kind === 'end' && (
              <EndLinkDialog link={dialog.link} onClose={() => setDialog(null)} onDone={done} />
            )}
            {dialog?.kind === 'link' && (
              <LinkDialog link={dialog.link} onClose={() => setDialog(null)} onDone={done} />
            )}
            <ConfirmReason
              open={dialog?.kind === 'delete'}
              title={`Delete ${r.name}?`}
              description="The person is removed from the society records. This needs a recent sign-in."
              confirmLabel="Delete person"
              onCancel={() => setDialog(null)}
              onConfirm={async reason => {
                if (
                  await run(() => residentsService.deleteResident(r.id, reason, r.version), 'Person deleted')
                ) {
                  setDialog(null);
                  onChanged();
                  onClose();
                }
              }}
            />
            <ConfirmReason
              open={dialog?.kind === 'reject'}
              title="Reject this document?"
              description="The person is told why."
              confirmLabel="Reject"
              onCancel={() => setDialog(null)}
              onConfirm={async reason => {
                if (dialog?.kind !== 'reject') return;
                if (
                  await run(
                    () =>
                      residentsService.verifyDocument(dialog.doc.id, {
                        decision: 'REJECTED',
                        reason,
                        version: dialog.doc.version ?? 1,
                      }),
                    'Document rejected',
                  )
                )
                  done();
              }}
            />
            <ConfirmReason
              open={dialog?.kind === 'remove'}
              title="Remove this document?"
              confirmLabel="Remove"
              onCancel={() => setDialog(null)}
              onConfirm={async reason => {
                if (dialog?.kind !== 'remove') return;
                if (
                  await run(() => residentsService.deleteDocument(dialog.doc.id, reason), 'Document removed')
                )
                  done();
              }}
            />
          </>
        )}
      </Loading>
    </Drawer>
  );
}

function EditDialog({ r, onClose, onDone }: { r: ResidentDetail; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(r.name);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter the full name.';
    if (mobile && !isValidMobile(mobile)) e.mobile = 'Enter a 10 digit Indian mobile number.';
    if (email && !isValidEmail(email)) e.email = 'Enter a valid email address.';
    setErrs(e);
    if (Object.keys(e).length) return { error: 'Check the highlighted fields.' };
    const body: Record<string, unknown> = { version: r.version };
    if (name.trim() !== r.name) body.name = name.trim();
    if (mobile) body.mobile = normaliseMobile(mobile);
    if (email) body.email = email.trim();
    if (Object.keys(body).length === 1) return { error: 'Change at least one detail.' };
    await residentsService.updateResident(r.id, body);
    return { message: 'Details saved' };
  };
  return (
    <FormDialog
      title="Edit resident"
      submitLabel="Save changes"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} error={errs.name} />
      <Input
        label="New mobile"
        inputMode="numeric"
        value={mobile}
        onChange={e => setMobile(e.target.value)}
        error={errs.mobile}
        hint={
          r.hasLogin
            ? 'This person has a login and changes the mobile in their own security settings.'
            : 'Leave empty to keep the current number.'
        }
        disabled={r.hasLogin}
      />
      <Input
        label="New email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        error={errs.email}
        hint="Leave empty to keep the current email."
      />
    </FormDialog>
  );
}

function UploadDialog({
  residentId,
  onClose,
  onDone,
}: {
  residentId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<number | null>(null);
  const [type, setType] = useState<DocType>('AADHAAR');
  const [last4, setLast4] = useState('');
  const [title, setTitle] = useState('');
  const submit = async () => {
    if (!file) return { error: 'Choose a file first.' };
    if (type === 'OTHER' && title.trim().length < 2) return { error: 'Add a title for this document.' };
    await residentsService.addDocument(residentId, {
      fileId: file,
      docType: type,
      ...(last4 ? { idLast4: last4.toUpperCase() } : {}),
      ...(type === 'OTHER' ? { title: title.trim() } : {}),
    });
    return { message: 'Document uploaded' };
  };
  return (
    <FormDialog
      title="Upload document"
      submitLabel="Upload"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <Select
        label="Document type"
        value={type}
        onChange={e => setType(e.target.value as DocType)}
        options={UPLOAD_TYPES.map(t => ({ value: t, label: docLabel(t) }))}
      />
      {type === 'OTHER' && <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />}
      <Input
        label="Last 4 characters of the ID number (optional)"
        maxLength={4}
        value={last4}
        onChange={e => setLast4(e.target.value)}
        hint="Only the last 4 characters are kept on screen."
      />
      <FileField label="File" purpose="KYC_DOCUMENT" onChange={setFile} />
    </FormDialog>
  );
}

function EndLinkDialog({
  link,
  onClose,
  onDone,
}: {
  link: ResidentLink;
  onClose: () => void;
  onDone: () => void;
}) {
  const [to, setTo] = useState(today());
  const [reason, setReason] = useState('MOVED_OUT');
  const [note, setNote] = useState('');
  const submit = async () => {
    if (!isoDate(to)) return { error: 'Choose the end date.' };
    if ((reason === 'OTHER' || reason === 'DECEASED') && note.trim().length < 2)
      return { error: 'Add a short note for this reason.' };
    await residentsService.endLink(link.linkId, {
      toDate: to,
      endReason: reason as 'OTHER',
      ...(note ? { endNote: note.trim() } : {}),
      version: link.version ?? 1,
    });
    return {
      message: reason === 'DECEASED' ? 'Link ended. You may now start an ownership transfer.' : 'Link ended',
    };
  };
  return (
    <FormDialog
      title={`End link to ${link.unitLabel}`}
      submitLabel="End link"
      variant="danger"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <Input label="Last day" type="date" value={to} onChange={e => setTo(e.target.value)} />
      <Select
        label="Reason"
        value={reason}
        onChange={e => setReason(e.target.value)}
        options={END_REASONS.map(([value, label]) => ({ value, label }))}
      />
      <Input
        label="Note"
        value={note}
        onChange={e => setNote(e.target.value)}
        hint="Needed for Other and Deceased."
      />
    </FormDialog>
  );
}

function LinkDialog({
  link,
  onClose,
  onDone,
}: {
  link: ResidentLink;
  onClose: () => void;
  onDone: () => void;
}) {
  const [share, setShare] = useState(link.sharePercent ?? '');
  const [primary, setPrimary] = useState(false);
  const [residing, setResiding] = useState(link.isResiding);
  const submit = async () => {
    await residentsService.updateLink(link.linkId, {
      ...(share && share !== link.sharePercent ? { sharePercent: share } : {}),
      ...(primary ? { isPrimary: true } : {}),
      isResiding: residing,
      version: link.version ?? 1,
    });
    return { message: 'Link saved' };
  };
  return (
    <FormDialog
      title={`Edit link to ${link.unitLabel}`}
      description="For several owners, set all shares together from the flat."
      submitLabel="Save"
      onClose={onClose}
      onSubmit={submit}
      onDone={onDone}
    >
      <Input label="Share %" inputMode="decimal" value={share} onChange={e => setShare(e.target.value)} />
      {!link.isPrimary && (
        <Checkbox
          label="Make primary contact"
          checked={primary}
          onChange={e => setPrimary(e.target.checked)}
        />
      )}
      <Checkbox label="Lives in the flat" checked={residing} onChange={e => setResiding(e.target.checked)} />
    </FormDialog>
  );
}

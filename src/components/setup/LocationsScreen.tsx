'use client';
import { useMemo, useState } from 'react';
import { QrCode } from '@/components/auth/QrCode';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useFeature } from '@/hooks/useFeature';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { societySetupService } from '@/services/society-setup.service';
import type { LocationNode } from '@/types/societySetup';
import { Gate } from './Gate';
import { AREA_TYPES, areaTypeLabel, fieldErrors, setupError } from './format';

type Dialog =
  | { kind: 'add'; parent: LocationNode | null; initial?: 'FLOOR' | 'AREA' }
  | { kind: 'edit'; node: LocationNode }
  | { kind: 'move'; node: LocationNode }
  | { kind: 'qr'; node: LocationNode };

const flatten = (nodes: LocationNode[], out: LocationNode[] = []) => {
  for (const n of nodes) {
    out.push(n);
    flatten(n.children ?? [], out);
  }
  return out;
};

/** Settings > Locations (spec 11.8): the tree of buildings, floors, common areas and gates. */
export function LocationsScreen() {
  return (
    <Gate view={PERMISSIONS.residents.units.view} feature="property.common_areas_registry" title="Locations">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const canEdit = usePermission(PERMISSIONS.settings.society.edit);
  const toast = useToast();
  const [archived, setArchived] = useState(false);
  const { data, error, loading, reload } = useLoad(
    () => societySetupService.locations({ status: archived ? 'ALL' : 'ACTIVE' }),
    archived,
  );
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const roots = useMemo(() => data ?? [], [data]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast.show(done);
      reload();
    } catch (e) {
      toast.show(setupError(e), 'error');
    }
  };

  return (
    <Page>
      <PageHead
        title="Locations"
        sub="Where things happen: buildings, floors, lobbies, gates and other common areas. Complaints and patrols can name them."
        actions={
          canEdit && (
            <Button onClick={() => setDialog({ kind: 'add', parent: null })}>Add area or gate</Button>
          )
        }
      />
      <Card>
        <Checkbox label="Show archived" checked={archived} onChange={e => setArchived(e.target.checked)} />
        {error ? (
          <ErrorState
            error={error}
            action={
              <button className="underline" onClick={reload}>
                Try again
              </button>
            }
          />
        ) : loading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        ) : roots.length === 0 ? (
          <EmptyState
            title="No locations yet"
            text="Buildings appear here automatically. Add a common area or a gate to start."
          />
        ) : (
          <ul role="tree" aria-label="Locations" className="space-y-1">
            {roots.map(n => (
              <Node key={n.id} node={n} depth={0} canEdit={canEdit} setDialog={setDialog} act={act} />
            ))}
          </ul>
        )}
      </Card>
      {dialog?.kind === 'add' && (
        <AddModal
          parent={dialog.parent}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSaved={reload}
        />
      )}
      {dialog?.kind === 'edit' && (
        <EditModal node={dialog.node} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {dialog?.kind === 'move' && (
        <MoveModal node={dialog.node} roots={roots} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {dialog?.kind === 'qr' && (
        <QrModal node={dialog.node} canEdit={canEdit} onClose={() => setDialog(null)} onSaved={reload} />
      )}
    </Page>
  );
}

function Node({
  node,
  depth,
  canEdit,
  setDialog,
  act,
}: {
  node: LocationNode;
  depth: number;
  canEdit: boolean;
  setDialog: (d: Dialog) => void;
  act: (fn: () => Promise<unknown>, done: string) => void;
}) {
  const qrOn = useFeature('property.unit_qr_codes');
  const isArchived = node.status === 'ARCHIVED';
  const managed = node.nodeType === 'BUILDING';
  const kids = node.children ?? [];
  return (
    <li
      role="treeitem"
      aria-expanded={kids.length ? true : undefined}
      aria-level={depth + 1}
      aria-selected={false}
    >
      <details open className="group" style={{ marginLeft: depth > 0 ? 12 : 0 }}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-[12px] bg-white/50 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{node.name}</span>
            <span className="ml-2 text-[12.5px] text-muted">
              {node.nodeType === 'BUILDING'
                ? 'Building'
                : node.nodeType === 'FLOOR'
                  ? 'Floor'
                  : areaTypeLabel(node.areaType)}
            </span>
          </span>
          {isArchived && <Chip>Archived</Chip>}
        </summary>
        <div className="flex flex-wrap gap-1.5 px-3 py-1.5">
          {canEdit && !isArchived && (
            <>
              {node.nodeType === 'BUILDING' && (
                <Button
                  size="xs"
                  variant="glass"
                  aria-label={`Add floor to ${node.name}`}
                  onClick={() => setDialog({ kind: 'add', parent: node, initial: 'FLOOR' })}
                >
                  Add floor
                </Button>
              )}
              <Button
                size="xs"
                variant="glass"
                aria-label={`Add area under ${node.name}`}
                onClick={() => setDialog({ kind: 'add', parent: node, initial: 'AREA' })}
              >
                Add area
              </Button>
            </>
          )}
          {canEdit && !managed && !isArchived && (
            <>
              {node.nodeType === 'AREA' && (
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label={`Rename ${node.name}`}
                  onClick={() => setDialog({ kind: 'edit', node })}
                >
                  Rename
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Move ${node.name}`}
                onClick={() => setDialog({ kind: 'move', node })}
              >
                Move
              </Button>
            </>
          )}
          {canEdit && !managed && !isArchived && (
            <Button
              size="xs"
              variant="danger-soft"
              aria-label={`Archive ${node.name}`}
              onClick={() =>
                act(
                  () => societySetupService.archiveLocation(node.id, node.version ?? 1),
                  `${node.name} archived.`,
                )
              }
            >
              Archive
            </Button>
          )}
          {canEdit && !managed && isArchived && (
            <Button
              size="xs"
              variant="glass"
              aria-label={`Restore ${node.name}`}
              onClick={() =>
                act(
                  () => societySetupService.restoreLocation(node.id, node.version ?? 1),
                  `${node.name} restored.`,
                )
              }
            >
              Restore
            </Button>
          )}
          {qrOn && node.qrToken && (
            <Button
              size="xs"
              variant="glass"
              aria-label={`Print QR for ${node.name}`}
              onClick={() => setDialog({ kind: 'qr', node })}
            >
              Print QR
            </Button>
          )}
        </div>
        {kids.length > 0 && (
          <ul role="group" className="space-y-1">
            {kids.map(c => (
              <Node key={c.id} node={c} depth={depth + 1} canEdit={canEdit} setDialog={setDialog} act={act} />
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

function AddModal({
  parent,
  initial = 'AREA',
  onClose,
  onSaved,
}: {
  parent: LocationNode | null;
  initial?: 'FLOOR' | 'AREA';
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const gatesOn = useFeature('property.gates_registry');
  const canFloor = parent?.nodeType === 'BUILDING';
  const [kind, setKind] = useState<'FLOOR' | 'AREA'>(initial);
  const [floor, setFloor] = useState('1');
  const [name, setName] = useState('');
  const [areaType, setAreaType] = useState('LOBBY');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const types = AREA_TYPES.filter(t => t !== 'GATE' || (gatesOn && parent === null));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (kind === 'FLOOR' && !Number.isInteger(Number(floor))) e.floor = 'Enter a floor number.';
    if (kind === 'AREA' && (name.trim().length < 2 || name.trim().length > 80))
      e.name = 'Enter a name of 2 to 80 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await societySetupService.createLocation(
        kind === 'FLOOR'
          ? { parentId: parent!.id, nodeType: 'FLOOR', floor: Number(floor) }
          : {
              parentId: parent?.id ?? null,
              nodeType: 'AREA',
              name: name.trim(),
              areaType,
              notes: notes.trim() || null,
            },
      );
      toast.show(kind === 'FLOOR' ? 'Floor added.' : 'Area added.');
      onSaved();
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(setupError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={parent ? `Add under ${parent.name}` : 'Add area or gate'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Add
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      {canFloor && (
        <Select
          label="What to add"
          value={kind}
          onChange={e => setKind(e.target.value as 'FLOOR' | 'AREA')}
          options={[
            { value: 'AREA', label: 'Area' },
            { value: 'FLOOR', label: 'Floor' },
          ]}
        />
      )}
      {kind === 'FLOOR' ? (
        <Input
          label="Floor number"
          type="number"
          value={floor}
          onChange={e => setFloor(e.target.value)}
          error={errors.floor}
          hint="The floor must be inside the building's floors."
        />
      ) : (
        <>
          <Input
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            error={errors.name}
            maxLength={80}
          />
          <Select
            label="Type"
            value={areaType}
            onChange={e => setAreaType(e.target.value)}
            options={types.map(t => ({ value: t, label: areaTypeLabel(t) }))}
          />
          <Input
            label="Notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            error={errors.notes}
            maxLength={300}
          />
        </>
      )}
    </Modal>
  );
}

function EditModal({
  node,
  onClose,
  onSaved,
}: {
  node: LocationNode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(node.name);
  const [areaType, setAreaType] = useState(node.areaType ?? 'OTHER');
  const [notes, setNotes] = useState(node.notes ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gatesOn = useFeature('property.gates_registry');
  const types = AREA_TYPES.filter(t => t !== 'GATE' || gatesOn || node.areaType === 'GATE');
  const submit = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await societySetupService.updateLocation(node.id, {
        name: name.trim(),
        areaType,
        notes: notes.trim() || null,
        version: node.version ?? 1,
      });
      toast.show('Location saved.');
      onSaved();
      onClose();
    } catch (err) {
      setFormError(setupError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Rename ${node.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <Input label="Name" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
      <Select
        label="Type"
        value={areaType}
        onChange={e => setAreaType(e.target.value)}
        options={types.map(t => ({ value: t, label: areaTypeLabel(t) }))}
      />
      <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} />
    </Modal>
  );
}

function MoveModal({
  node,
  roots,
  onClose,
  onSaved,
}: {
  node: LocationNode;
  roots: LocationNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [parent, setParent] = useState(node.parentId ? String(node.parentId) : '');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const own = new Set(flatten([node]).map(n => n.id));
  const options = flatten(roots).filter(n => !own.has(n.id) && n.status !== 'ARCHIVED');
  const submit = async () => {
    setBusy(true);
    setFormError(null);
    try {
      await societySetupService.updateLocation(node.id, {
        parentId: parent ? Number(parent) : null,
        version: node.version ?? 1,
      });
      toast.show('Location moved.');
      onSaved();
      onClose();
    } catch (err) {
      setFormError(setupError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Move ${node.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit}>
            Move
          </Button>
        </>
      }
    >
      {formError && <Alert tone="bad">{formError}</Alert>}
      <Select
        label="New parent"
        value={parent}
        onChange={e => setParent(e.target.value)}
        options={[
          { value: '', label: 'Top level (society)' },
          ...options.map(o => ({ value: String(o.id), label: o.pathLabel ?? o.name })),
        ]}
      />
    </Modal>
  );
}

function QrModal({
  node,
  canEdit,
  onClose,
  onSaved,
}: {
  node: LocationNode;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [token, setToken] = useState(node.qrToken ?? '');
  const [version, setVersion] = useState(node.version ?? 1);
  const [busy, setBusy] = useState(false);
  const regen = async () => {
    setBusy(true);
    try {
      const n = await societySetupService.regenerateQr(node.id, version);
      setToken(n.qrToken ?? token);
      setVersion(n.version ?? version + 1);
      toast.show('New QR code made. The old one no longer works.');
      onSaved();
    } catch (err) {
      toast.show(setupError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`QR code for ${node.name}`}
      description={node.pathLabel}
      footer={
        <>
          {canEdit && (
            <Button variant="danger-soft" loading={busy} onClick={regen}>
              Make a new code
            </Button>
          )}
          <Button variant="glass" onClick={() => window.print()}>
            Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2">
        <QrCode value={token} label={`QR code for ${node.name}`} />
        <code className="text-[13px]">{token}</code>
      </div>
    </Modal>
  );
}

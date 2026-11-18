'use client';
import { useMemo, useRef, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { useLoad } from '@/hooks/useLoad';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import { helpdeskSettingsService } from '@/services/helpdeskSettings.service';
import { societySetupService } from '@/services/society-setup.service';
import type { LocationNode } from '@/types/societySetup';
import type { Category } from '@/types/helpdesk';
import { helpdeskError } from './format';

export const MAX_FILES = 6;

export interface UploadedFile {
  fileId: number;
  name: string;
}

/** Up to six photos or videos. Each is uploaded as soon as it is chosen (purpose `TICKET_ATTACHMENT`). */
export function AttachmentPicker({
  label = 'Photos',
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const available = fileUploadAvailable();
  const pick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setProblem(null);
    setBusy(true);
    const next = [...value];
    try {
      for (const f of Array.from(list)) {
        if (next.length >= MAX_FILES) {
          setProblem(`You can add up to ${MAX_FILES} files.`);
          break;
        }
        const up = await uploadFile(f, 'TICKET_ATTACHMENT');
        next.push({ fileId: up.fileId, name: f.name });
      }
    } catch (e) {
      setProblem(helpdeskError(e));
    } finally {
      onChange(next);
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div>
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {value.map(f => (
          <Chip key={f.fileId} tone="info">
            {f.name}
            <button
              type="button"
              aria-label={`Remove ${f.name}`}
              className="ml-1.5 font-bold"
              onClick={() => onChange(value.filter(x => x.fileId !== f.fileId))}
            >
              x
            </button>
          </Chip>
        ))}
        {value.length < MAX_FILES && (
          <label className="cursor-pointer rounded-full bg-white/60 px-3.5 py-1.5 text-[13px] font-semibold">
            {busy ? 'Uploading' : 'Add photo'}
            <input
              ref={input}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              multiple
              className="sr-only"
              aria-label={label}
              disabled={disabled || busy || !available}
              onChange={e => void pick(e.target.files)}
            />
          </label>
        )}
      </div>
      {!available && <p className="mt-1 text-[12.5px] text-muted">File upload is not available yet.</p>}
      {problem && (
        <p role="alert" className="mt-1 text-[12.5px] text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}

export interface Spot {
  id: number;
  label: string;
  nodeType: string;
  buildingId: number | null;
}

/** The location tree flattened to pickable spots (buildings, floors and areas), each with its full path label. */
export function flattenSpots(tree: LocationNode[]): Spot[] {
  const out: Spot[] = [];
  const walk = (n: LocationNode, path: string[], buildingId: number | null) => {
    const here = [...path, n.name];
    const bId = n.nodeType === 'BUILDING' ? n.id : buildingId;
    if (n.status !== 'ARCHIVED')
      out.push({
        id: n.id,
        // A building itself is a valid spot (BR-15-3): "Whole Tower A".
        label: n.nodeType === 'BUILDING' ? `Whole ${n.name}` : (n.pathLabel ?? here.join(' › ')),
        nodeType: n.nodeType,
        buildingId: n.buildingId ?? bId,
      });
    n.children.forEach(c => walk(c, here, bId));
  };
  tree.forEach(n => walk(n, [], null));
  return out;
}

/** Buildings are the top-level BUILDING nodes of the tree. */
export function buildingNodes(tree: LocationNode[]): { id: number; name: string; buildingId: number }[] {
  const out: { id: number; name: string; buildingId: number }[] = [];
  const walk = (n: LocationNode) => {
    if (n.nodeType === 'BUILDING') out.push({ id: n.id, name: n.name, buildingId: n.buildingId ?? n.id });
    n.children.forEach(walk);
  };
  tree.forEach(walk);
  return out;
}

export function useLocations() {
  const load = useLoad(
    () => societySetupService.locations({ status: 'ACTIVE' }).catch(() => [] as LocationNode[]),
    'locations',
  );
  const spots = useMemo(() => flattenSpots(load.data ?? []), [load.data]);
  const buildings = useMemo(() => buildingNodes(load.data ?? []), [load.data]);
  return { spots, buildings, loading: load.loading };
}

/** Active categories as a flat list for pickers (top level) plus the children of each. */
export function useCategories(scope?: 'PERSONAL' | 'BUILDING') {
  const load = useLoad(() => helpdeskSettingsService.categories('ACTIVE', scope), `cat-${scope ?? 'all'}`);
  const tops: Category[] = useMemo(
    () => (load.data ?? []).filter(c => !scope || c.scope === scope || c.scope === 'BOTH'),
    [load.data, scope],
  );
  return { tops, loading: load.loading, error: load.error };
}

export function CategorySelect({
  categories,
  categoryId,
  subCategoryId,
  onChange,
  errors,
}: {
  categories: Category[];
  categoryId: string;
  subCategoryId: string;
  onChange: (categoryId: string, subCategoryId: string) => void;
  errors?: { category?: string | null; sub?: string | null };
}) {
  const top = categories.find(c => String(c.id) === categoryId);
  const subs = (top?.children ?? []).filter(c => c.status === 'ACTIVE');
  return (
    <>
      <Select
        label="Category"
        value={categoryId}
        onChange={e => onChange(e.target.value, '')}
        error={errors?.category}
        options={[
          { value: '', label: 'Choose a category' },
          ...categories.map(c => ({ value: String(c.id), label: c.name })),
        ]}
      />
      {subs.length > 0 && (
        <Select
          label="Sub-category (optional)"
          value={subCategoryId}
          onChange={e => onChange(categoryId, e.target.value)}
          error={errors?.sub}
          options={[{ value: '', label: 'None' }, ...subs.map(c => ({ value: String(c.id), label: c.name }))]}
        />
      )}
    </>
  );
}

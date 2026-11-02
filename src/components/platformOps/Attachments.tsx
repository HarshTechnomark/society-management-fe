'use client';
import { useState } from 'react';
import { bytes } from '@/components/societies/format';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';
import type { TicketAttachment } from '@/types/platformOps';

const MAX = 5;

interface Item {
  name: string;
  fileId: number | null;
  busy: boolean;
  error: boolean;
}

/**
 * Up to five files behind the upload adapter (`lib/fileUpload`). Reports the uploaded file ids. When no
 * uploader is registered yet the control says so and the form can still be sent without files.
 */
export function Attachments({
  label = 'Attach files',
  camera,
  onChange,
}: {
  label?: string;
  /** Opens the camera on phones (screenshots). */
  camera?: boolean;
  onChange: (fileIds: number[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const available = fileUploadAvailable();

  const report = (next: Item[]) => {
    setItems(next);
    onChange(next.filter(i => i.fileId !== null).map(i => i.fileId as number));
  };
  const add = async (files: FileList | null) => {
    if (!files) return;
    let current = items;
    for (const f of Array.from(files).slice(0, MAX - items.length)) {
      current = [...current, { name: f.name, fileId: null, busy: true, error: false }];
      const index = current.length - 1;
      setItems(current);
      try {
        const r = await uploadFile(f, 'PLATFORM_ATTACHMENT');
        current = current.map((c, i) => (i === index ? { ...c, fileId: r.fileId, busy: false } : c));
      } catch {
        current = current.map((c, i) => (i === index ? { ...c, busy: false, error: true } : c));
      }
      report(current);
    }
  };

  return (
    <div className="mb-3">
      <label htmlFor="ticket-files" className="mb-1.5 block text-[13px] font-semibold">
        {label} <span className="font-normal text-muted">(up to {MAX})</span>
      </label>
      <input
        id="ticket-files"
        type="file"
        multiple
        accept="image/png,image/jpeg,application/pdf"
        capture={camera ? 'environment' : undefined}
        disabled={!available || items.length >= MAX}
        onChange={e => {
          void add(e.target.files);
          e.target.value = '';
        }}
        className="block w-full text-[14px]"
      />
      {!available && (
        <p className="mt-1.5 text-[12.5px] text-muted">
          File upload is not available yet. You can send this without files.
        </p>
      )}
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((i, n) => (
            <li
              key={`${i.name}-${n}`}
              className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[12.5px]"
            >
              <span>{i.name}</span>
              {i.busy && <span className="text-muted">Uploading...</span>}
              {i.error && (
                <span role="alert" className="font-medium text-bad">
                  Failed
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${i.name}`}
                className="font-bold text-muted hover:text-ink"
                onClick={() => report(items.filter((_, k) => k !== n))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Attachment chips on a message (file bytes are served by the module 01 file service). */
export function AttachmentChips({ files }: { files?: TicketAttachment[] }) {
  if (!files?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {files.map(f => (
        <li
          key={f.fileId}
          className="rounded-full bg-[rgba(20,35,44,0.08)] px-2.5 py-0.5 text-[12px]"
          title={f.status === 'CLEAN' ? undefined : 'Being checked'}
        >
          {f.originalName} · {bytes(f.sizeBytes)}
          {f.status !== 'CLEAN' && ' · checking'}
        </li>
      ))}
    </ul>
  );
}

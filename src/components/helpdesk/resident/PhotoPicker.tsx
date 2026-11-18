'use client';
import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { fileUploadAvailable, uploadFile } from '@/lib/fileUpload';

export const MAX_PHOTOS = 6;

/** Uploads every chosen photo (purpose TICKET_PHOTO) and returns the file ids, in order. */
export async function uploadPhotos(files: File[]): Promise<number[]> {
  const ids: number[] = [];
  for (const f of files) ids.push((await uploadFile(f, 'TICKET_PHOTO')).fileId);
  return ids;
}

/** Up to six photos; the bytes are sent when the form is submitted. Works without an uploader (says so). */
export function PhotoPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const can = fileUploadAvailable();
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold">Photos (optional)</div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="Add photos"
        data-testid="photo-input"
        onChange={e => {
          const picked = Array.from(e.target.files ?? []);
          onChange([...files, ...picked].slice(0, MAX_PHOTOS));
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="glass"
          size="sm"
          disabled={disabled || !can || files.length >= MAX_PHOTOS}
          onClick={() => input.current?.click()}
        >
          Add photo
        </Button>
        {files.map((f, i) => (
          <span
            key={`${f.name}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[12px]"
          >
            <span className="max-w-[9rem] truncate">{f.name}</span>
            <button
              type="button"
              aria-label={`Remove ${f.name}`}
              className="font-bold"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {!can && (
        <p className="mt-1 text-[12px] text-muted">Photos cannot be added right now. You can still send.</p>
      )}
    </div>
  );
}

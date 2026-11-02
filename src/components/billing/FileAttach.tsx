'use client';
import { useState } from 'react';
import { fileUploadAvailable, uploadFile, type FilePurpose } from '@/lib/fileUpload';

/** A file picker behind the upload adapter. Reports the uploaded file id, or null when removed. */
export function FileAttach({
  label,
  purpose,
  onChange,
}: {
  label: string;
  purpose: FilePurpose;
  onChange: (fileId: number | null) => void;
}) {
  const [state, setState] = useState<{ name: string; busy: boolean; error: string | null } | null>(null);
  const available = fileUploadAvailable();
  return (
    <div className="mb-4">
      <label htmlFor={`file-${purpose}`} className="mb-1.5 block text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={`file-${purpose}`}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        disabled={!available}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (!f) {
            onChange(null);
            setState(null);
            return;
          }
          setState({ name: f.name, busy: true, error: null });
          try {
            const r = await uploadFile(f, purpose);
            onChange(r.fileId);
            setState({ name: f.name, busy: false, error: null });
          } catch {
            onChange(null);
            setState({ name: f.name, busy: false, error: 'The file could not be uploaded. Try again.' });
          }
        }}
        className="block w-full text-[14px]"
      />
      {!available && (
        <p className="mt-1.5 text-[12.5px] text-muted">
          File upload is not available yet. You can send this without a file and attach it later.
        </p>
      )}
      {state?.busy && <p className="mt-1.5 text-[12.5px] text-muted">Uploading {state.name}...</p>}
      {state?.error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-bad">
          {state.error}
        </p>
      )}
    </div>
  );
}

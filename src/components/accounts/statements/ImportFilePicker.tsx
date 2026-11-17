'use client';
import { useId } from 'react';
import { MAX_IMPORT_BYTES } from './format';
import { fileUploadAvailable } from '@/lib/fileUpload';

/** Picks a CSV or XLSX file; reports it (or null) so the form can upload it on submit. */
export function ImportFilePicker({
  label,
  file,
  error,
  onChange,
}: {
  label: string;
  file: File | null;
  error?: string;
  onChange: (f: File | null, problem?: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="block w-full text-[14px]"
        onChange={e => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > MAX_IMPORT_BYTES) onChange(null, 'The file is larger than 20 MB.');
          else if (f && !/\.(csv|xlsx)$/i.test(f.name)) onChange(null, 'Choose a CSV or XLSX file.');
          else onChange(f);
        }}
      />
      {file && <p className="mt-1.5 text-[12.5px] text-[#14583a]">Chosen: {file.name}</p>}
      {!fileUploadAvailable() && (
        <p className="mt-1.5 text-[12.5px] text-muted">File upload is not available yet.</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

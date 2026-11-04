'use client';
import { useEffect, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useLoad } from '@/hooks/useLoad';
import { billingInvoicesService } from '@/services/billingInvoices.service';
import type { InvoiceStatus, NoteStatus, UnitOption } from '@/types/billingInvoices';
import {
  NOTE_STATUS_LABEL,
  NOTE_STATUS_MARK,
  NOTE_STATUS_TONE,
  STATUS_LABEL,
  STATUS_MARK,
  STATUS_TONE,
} from './format';

/** The status in words with a mark, so it never relies on colour alone. */
export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <Chip tone={STATUS_TONE[status] ?? 'neutral'}>
      <span aria-hidden="true" className="mr-1">
        {STATUS_MARK[status]}
      </span>
      {STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

export function OverdueChip() {
  return (
    <Chip tone="bad">
      <span aria-hidden="true" className="mr-1">
        !
      </span>
      Overdue
    </Chip>
  );
}

export function NoteStatusChip({ status }: { status: NoteStatus }) {
  return (
    <Chip tone={NOTE_STATUS_TONE[status] ?? 'neutral'}>
      <span aria-hidden="true" className="mr-1">
        {NOTE_STATUS_MARK[status]}
      </span>
      {NOTE_STATUS_LABEL[status] ?? status}
    </Chip>
  );
}

/** Finds a flat by typing part of its label (`GET /units?q=`), then picking it from the matches. */
export function UnitPicker({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  value: UnitOption | null;
  onChange: (u: UnitOption | null) => void;
  required?: boolean;
  error?: string;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const found = useLoad(() => (q ? billingInvoicesService.units(q) : Promise.resolve([])), q);
  if (value)
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="flex h-11 items-center gap-2 text-[14.5px]">
          <Chip tone="info">{value.label}</Chip>
          <button
            type="button"
            className="text-[13px] font-semibold text-navy underline"
            onClick={() => {
              onChange(null);
              setText('');
            }}
          >
            Change flat
          </button>
        </span>
      </div>
    );
  const options = found.data ?? [];
  return (
    <div>
      <Input
        label={label}
        placeholder="Type a flat number, for example A-101"
        value={text}
        onChange={e => setText(e.target.value)}
        required={required}
        error={error}
        autoComplete="off"
      />
      {q && !found.loading && (
        <Select
          label="Matching flats"
          value=""
          onChange={e => {
            const u = options.find(o => String(o.id) === e.target.value);
            if (u) onChange(u);
          }}
          options={[
            { value: '', label: options.length ? 'Pick a flat' : 'No flat matches' },
            ...options.map(o => ({ value: String(o.id), label: o.label })),
          ]}
        />
      )}
    </div>
  );
}

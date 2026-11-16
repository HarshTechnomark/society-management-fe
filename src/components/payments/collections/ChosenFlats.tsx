'use client';
import { useEffect, useState } from 'react';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { useLoad } from '@/hooks/useLoad';
import { collectionsService } from '@/services/collections.service';
import type { Option } from '@/types/collections';

/** Picks several flats by typing part of the flat number; the picked flats show as removable chips. */
export function ChosenFlats({
  value,
  onChange,
  error,
}: {
  value: Option[];
  onChange: (v: Option[]) => void;
  error?: string;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  const found = useLoad(() => (q ? collectionsService.units(q) : Promise.resolve([])), q);
  const options = (found.data ?? []).filter(o => !value.some(v => v.id === o.id));
  return (
    <div>
      <Input
        label="Find flats"
        placeholder="Type a flat number, for example A-101"
        value={text}
        onChange={e => setText(e.target.value)}
        error={error}
        autoComplete="off"
      />
      {q && !found.loading && (
        <ul aria-label="Matching flats" className="mb-3 flex flex-wrap gap-2">
          {options.length === 0 ? (
            <li className="text-[13px] text-muted">No flat matches</li>
          ) : (
            options.map(o => (
              <li key={o.id}>
                <button
                  type="button"
                  className="rounded-full bg-white/70 px-3 py-1 text-[13px] font-semibold hover:bg-white"
                  onClick={() => onChange([...value, o])}
                >
                  Add {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {value.length > 0 && (
        <ul aria-label="Chosen flats" className="mb-3 flex flex-wrap gap-2">
          {value.map(u => (
            <li key={u.id}>
              <Chip tone="info">
                {u.label}
                <button
                  type="button"
                  aria-label={`Remove ${u.label}`}
                  className="ml-1.5 font-bold"
                  onClick={() => onChange(value.filter(x => x.id !== u.id))}
                >
                  ×
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

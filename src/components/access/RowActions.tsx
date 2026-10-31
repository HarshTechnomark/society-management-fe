'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useIsPhone } from '@/hooks/useMediaQuery';

export interface RowAction {
  key: string;
  label: string;
  run: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Tooltip explaining a disabled button. */
  why?: string;
}

/** Inline buttons on desktop; one "More actions" button opening a bottom sheet on phones. */
export function RowActions({ actions, name }: { actions: RowAction[]; name: string }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  if (!phone)
    return (
      <div className="flex flex-wrap justify-end gap-1.5" onClick={e => e.stopPropagation()}>
        {actions.map(a => (
          <Button
            key={a.key}
            size="xs"
            variant={a.danger ? 'danger-soft' : 'glass'}
            disabled={a.disabled}
            title={a.disabled ? a.why : undefined}
            aria-label={`${a.label} ${name}`}
            onClick={a.run}
          >
            {a.label}
          </Button>
        ))}
      </div>
    );
  return (
    <div className="flex justify-end" onClick={e => e.stopPropagation()}>
      <Button size="xs" variant="glass" aria-label={`More actions for ${name}`} onClick={() => setOpen(true)}>
        ⋯
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={name}>
        <ul className="flex flex-col gap-2">
          {actions.map(a => (
            <li key={a.key}>
              <Button
                block
                variant={a.danger ? 'danger-soft' : 'glass'}
                disabled={a.disabled}
                onClick={() => {
                  setOpen(false);
                  a.run();
                }}
              >
                {a.label}
              </Button>
              {a.disabled && a.why && <p className="mt-1 text-[12.5px] text-muted">{a.why}</p>}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { collectionsService } from '@/services/collections.service';
import type { Option } from '@/types/collections';
import { ChosenFlats } from './ChosenFlats';
import { collectionError } from './format';

/** Adds flats to a live collection (8.23 POST /collections/:id/requests). */
export function AddFlatsDialog({
  id,
  version,
  onCancel,
  onDone,
}: {
  id: number;
  version: number;
  onCancel: () => void;
  onDone: (added: number, skipped: number) => void;
}) {
  const [units, setUnits] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (units.length === 0 || units.length > 500) {
      setError('Choose 1 to 500 flats.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = (await collectionsService.addUnits(id, { unitIds: units.map(u => u.id), version })) as {
        skippedUnitIds?: unknown;
        addedCount?: unknown;
      } | null;
      const skipped = Array.isArray(r?.skippedUnitIds) ? r.skippedUnitIds.length : 0;
      const added = typeof r?.addedCount === 'number' ? r.addedCount : units.length - skipped;
      onDone(added, skipped);
    } catch (e) {
      setError(collectionError(e));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="Add flats"
      description="Flats that already have a request are skipped."
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Add flats
          </Button>
        </>
      }
    >
      <ChosenFlats value={units} onChange={setUnits} error={error ?? undefined} />
    </Modal>
  );
}

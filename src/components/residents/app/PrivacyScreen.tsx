'use client';
import { useState } from 'react';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Switch } from '@/components/ui/Switch';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { residentsService } from '@/services/residents.service';
import type { Privacy } from '@/types/residents';
import { Loading, useRun } from '../common';

const ROWS: { key: Exclude<keyof Privacy, 'version'>; label: string; text: string }[] = [
  {
    key: 'directoryVisible',
    label: 'Show me in the directory',
    text: 'Neighbours can find your name and flat.',
  },
  {
    key: 'showMobileInDirectory',
    label: 'Show my mobile number',
    text: 'Only in the directory, only to neighbours.',
  },
  { key: 'showEmailInDirectory', label: 'Show my email', text: 'Only in the directory, only to neighbours.' },
  { key: 'showPhotoInDirectory', label: 'Show my photo', text: 'Only in the directory, only to neighbours.' },
];

/** Privacy (spec 11.2): the four directory switches (BR-09-73). */
export function PrivacyScreen() {
  return (
    <Gate view={PERMISSIONS.resident.home.view} feature="residents.person_registry" title="Privacy">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const load = useLoad(() => residentsService.privacy(), 'p');
  return (
    <Page>
      <PageHead title="Privacy" sub="You decide what neighbours see about you." />
      <Loading load={load} rows={4}>
        {p => <Form key={p.version} initial={p} />}
      </Loading>
    </Page>
  );
}

function Form({ initial }: { initial: Privacy }) {
  const run = useRun();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const change = async (key: (typeof ROWS)[number]['key'], value: boolean) => {
    setBusy(true);
    let saved: Privacy | null = null;
    const ok = await run(async () => {
      saved = await residentsService.savePrivacy({ [key]: value, version: p.version });
    }, 'Saved');
    if (ok) setP(saved ?? { ...p, [key]: value, version: p.version + 1 });
    setBusy(false);
  };
  return (
    <Card>
      <ul>
        {ROWS.map(r => (
          <li
            key={r.key}
            className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-3 last:border-0"
          >
            <div>
              <p className="text-[15px] font-semibold">{r.label}</p>
              <p className="text-[13px] text-muted">{r.text}</p>
            </div>
            <Switch
              label={r.label}
              checked={p[r.key]}
              disabled={busy || (r.key !== 'directoryVisible' && !p.directoryVisible)}
              onChange={v => void change(r.key, v)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

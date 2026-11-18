'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Gate } from '@/components/setup/Gate';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useFeatureState } from '@/lib/entitlements';
import { inr } from '@/lib/money';
import { residentNoticesService as svc } from '@/services/residentNotices.service';
import type { NoticeAction, NoticeDetail } from '@/types/residentNotices';
import { commError, istDate, istTime, plainCommError } from '../format';
import { plainText, safeHtml } from '../safeHtml';
import { UTILITY_LABEL, actionHref, categoryLabel } from './format';

export function NoticeDetailScreen({ id }: { id: number }) {
  return (
    <Gate view={PERMISSIONS.resident.notices.view} title="Notices">
      <Inner id={id} />
    </Gate>
  );
}

function ActionButton({ a }: { a: NoticeAction }) {
  const href = actionHref(a);
  if (a.state === 'PAID') return <Chip tone="ok">Paid{a.receiptNo ? ` · ${a.receiptNo}` : ''}</Chip>;
  if (a.state === 'CLOSED' || !href) return <Chip>No longer open</Chip>;
  const label =
    a.type === 'PAY_COLLECTION' && a.amountPaise ? `Pay ${inr(a.amountPaise)}` : a.label || 'Open';
  const external = /^https?:/i.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses('gold', 'md')}>
      {label}
    </a>
  ) : (
    <Link href={href} className={buttonClasses('gold', 'md')}>
      {label}
    </Link>
  );
}

function Inner({ id }: { id: number }) {
  const toast = useToast();
  const canAck = usePermission(PERMISSIONS.resident.notices.edit);
  const listenOk = useFeatureState('communication.read_aloud_notices');
  const q = useLoad(() => svc.notice(id), id);
  const [acked, setAcked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const n: NoticeDetail | null = q.data;
  const html = useMemo(() => (n ? safeHtml(n.body) : ''), [n]);

  if (q.loading)
    return (
      <Page>
        <div className="skeleton h-48 w-full" />
      </Page>
    );
  if (!n)
    return (
      <Page>
        <ErrorState
          error={plainCommError(q.error)}
          action={<Button onClick={q.reload}>Try again</Button>}
          notFoundAction={
            <Link href="/resident/notices" className={buttonClasses('primary', 'md')}>
              Back to notices
            </Link>
          }
        />
      </Page>
    );

  const ackedAt = acked ?? n.acknowledgedAt;
  const acknowledge = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await svc.acknowledge(n.id);
      setAcked(r.acknowledgedAt || new Date().toISOString());
      toast.show('Thank you. Your acknowledgement is recorded.');
    } catch (e) {
      setError(commError(e));
    } finally {
      setBusy(false);
    }
  };
  const open = async (fileId: number) => {
    setError(null);
    try {
      const r = await svc.fileUrl(n.id, fileId);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      setError(commError(e));
    }
  };
  const listen = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(`${n.title}. ${plainText(n.body)}`);
    u.lang = n.locale;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const speechOk = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <Page>
      <p className="mb-2 text-[13px]">
        <Link href="/resident/notices" className="font-semibold text-navy hover:underline">
          Notices
        </Link>
      </p>
      <PageHead title={n.title} sub={`${categoryLabel(n.category)} · ${istDate(n.publishedAt)}`} />
      <Card>
        {error && <Alert tone="bad">{error}</Alert>}
        {n.status === 'EXPIRED' && <Alert tone="info">This notice has expired.</Alert>}
        {n.priority === 'HIGH' && (
          <Chip tone="bad" className="mb-2">
            Important
          </Chip>
        )}
        {n.utility && (
          <div className="mb-4 rounded-2xl bg-[#d8ebf3] p-3.5" aria-label="Utility shutdown">
            <p className="text-[15px] font-bold">{UTILITY_LABEL[n.utility.type] ?? 'Utility'} shutdown</p>
            <p className="text-[13.5px]">
              {istTime(n.utility.startsAt)} to {istTime(n.utility.endsAt)}
            </p>
            {n.utility.restoredAt && (
              <Chip tone="ok" className="mt-1.5">
                Restored {istTime(n.utility.restoredAt)}
              </Chip>
            )}
          </div>
        )}
        <div
          className="notice-body text-[15px] leading-relaxed [&_a]:text-navy [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {listenOk && speechOk && (
          <Button className="mt-3" variant="glass" size="sm" onClick={listen}>
            {speaking ? 'Stop' : 'Listen'}
          </Button>
        )}
        {n.attachments.length > 0 && (
          <section aria-label="Attachments" className="mt-4">
            <h3 className="mb-1.5 text-[14px] font-bold">Attachments</h3>
            <ul className="grid gap-1.5">
              {n.attachments.map(a => (
                <li key={a.fileId}>
                  <Button size="sm" variant="glass" onClick={() => void open(a.fileId)}>
                    {a.name}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {n.actions.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {n.actions.map((a, i) => (
              <ActionButton key={`${a.type}-${i}`} a={a} />
            ))}
          </div>
        )}
        {n.requiresAck && (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            {ackedAt ? (
              <Chip tone="ok">You acknowledged this on {istTime(ackedAt)}</Chip>
            ) : canAck && n.status === 'PUBLISHED' ? (
              <Button loading={busy} onClick={() => void acknowledge()}>
                I have read and understood
              </Button>
            ) : (
              <Chip tone="warn">Acknowledgement required</Chip>
            )}
          </div>
        )}
      </Card>
    </Page>
  );
}

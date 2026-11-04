'use client';
import { useEffect, useState } from 'react';
import { Pager, useServerList } from '@/components/billing/useServerList';
import { Avatar } from '@/components/access/Avatar';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { Empty, Loading } from '@/components/residents/common';
import { Gate } from '@/components/setup/Gate';
import { ErrorState } from '@/components/common/ErrorState';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { shortDate } from '@/lib/money';
import { committeeService } from '@/services/committee.service';
import { societySetupService } from '@/services/society-setup.service';
import type { MyCommittee, PastCommittee } from '@/types/committee';
import { JOIN_LABEL, PORTFOLIO_LABEL, plainError } from '../format';

type Member = MyCommittee['members'][number];

/** Resident app: Committee (spec 11.9): the current committee, how to reach them, and past committees. */
export function CommitteeResidentScreen() {
  return (
    <Gate view={PERMISSIONS.resident.home.view} feature="governance.committee_terms" title="Committee">
      <Inner />
    </Gate>
  );
}

function Inner() {
  const [past, setPast] = useState(false);
  return past ? <PastList onBack={() => setPast(false)} /> : <Current onPast={() => setPast(true)} />;
}

function Current({ onPast }: { onPast: () => void }) {
  const load = useLoad(() => committeeService.myCommittee());
  return (
    <Page>
      <PageHead
        title="Committee"
        sub="The people who manage your society."
        actions={
          <>
            <Button variant="glass" size="sm" onClick={load.reload}>
              Refresh
            </Button>
            <Button variant="glass" size="sm" onClick={onPast}>
              Past committees
            </Button>
          </>
        }
      />
      {load.error ? (
        <ErrorState
          error={plainError(load.error)}
          action={
            <Button size="sm" onClick={load.reload}>
              Try again
            </Button>
          }
        />
      ) : (
        <Loading load={load} rows={3}>
          {c => <Body c={c} />}
        </Loading>
      )}
    </Page>
  );
}

function Body({ c }: { c: MyCommittee }) {
  if (!c.visible)
    return (
      <Card>
        <Empty title="Your society has not published its committee." />
      </Card>
    );
  if (!c.term || c.members.length === 0)
    return (
      <Card>
        <Empty title="Committee details will appear here." />
      </Card>
    );
  return (
    <div>
      <Card className="mb-3">
        <h2 className="text-[19px] font-bold">{c.term.name}</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          {shortDate(c.term.startDate)} to {shortDate(c.term.endDate)}
        </p>
        {c.term.isOverdue && (
          <p className="mt-2">
            <Chip tone="warn">Caretaker committee</Chip>
          </p>
        )}
      </Card>
      {c.term.isOverdue && (
        <Alert tone="warn">
          The term has ended. This committee continues as caretaker until the new committee takes charge.
        </Alert>
      )}
      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Committee members">
        {c.members.map((m, i) => (
          <MemberCard key={`${m.name}-${i}`} m={m} />
        ))}
      </ul>
      {c.vacancies > 0 && (
        <p className="mt-3 text-[13.5px] text-muted">
          {c.vacancies} {c.vacancies === 1 ? 'seat is' : 'seats are'} vacant.
        </p>
      )}
    </div>
  );
}

/** The photo when a file URL can be had, else initials. */
function Photo({ fileId, name }: { fileId: number | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (fileId)
      societySetupService.fileDownloadUrl(fileId).then(
        r => live && setUrl(r.url),
        () => undefined,
      );
    return () => {
      live = false;
    };
  }, [fileId]);
  if (!url) return <Avatar name={name} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
}

function MemberCard({ m }: { m: Member }) {
  const masked = !!m.mobile && /[xX*]/.test(m.mobile);
  return (
    <li className="glass flex gap-3 p-3.5" data-testid="committee-member">
      <Photo fileId={m.photoFileId} name={m.name} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{m.name}</p>
        <p className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="gold">{m.designationLabel || m.designation}</Chip>
          {m.joinMode !== 'ELECTED' && <Chip>{JOIN_LABEL[m.joinMode] ?? m.joinMode}</Chip>}
        </p>
        {m.unitLabel && <p className="mt-1.5 text-[13px] text-muted">Flat {m.unitLabel}</p>}
        {m.mobile && (
          <p className="mt-1 text-[13px]">
            {masked ? (
              <span>
                <span className="sr-only">Mobile, partly hidden: </span>
                {m.mobile}
              </span>
            ) : (
              <a href={`tel:${m.mobile}`} className="font-semibold text-navy underline">
                {m.mobile}
              </a>
            )}
          </p>
        )}
        {m.publicEmail && (
          <p className="mt-1 break-all text-[13px]">
            <a href={`mailto:${m.publicEmail}`} className="font-semibold text-navy underline">
              {m.publicEmail}
            </a>
          </p>
        )}
        {m.portfolios.length > 0 && (
          <p className="mt-1 text-[13px] text-muted">
            {m.portfolios.map(p => PORTFOLIO_LABEL[p] ?? p).join(', ')}
          </p>
        )}
      </div>
    </li>
  );
}

function PastList({ onBack }: { onBack: () => void }) {
  const list = useServerList<PastCommittee>(
    page => committeeService.myHistory({ page, limit: 20 }),
    'past',
    20,
  );
  return (
    <Page>
      <PageHead
        title="Past committees"
        sub="Office bearers of earlier committees."
        actions={
          <Button variant="glass" size="sm" onClick={onBack}>
            Back to the committee
          </Button>
        }
      />
      {list.error ? (
        <ErrorState
          error={plainError(list.error)}
          action={
            <Button size="sm" onClick={list.reload}>
              Try again
            </Button>
          }
        />
      ) : list.loading && list.rows.length === 0 ? (
        <div aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton mb-3 h-14 w-full" data-testid="skeleton-row" />
          ))}
        </div>
      ) : list.rows.length === 0 ? (
        <Card>
          <Empty title="No past committees yet." />
        </Card>
      ) : (
        <>
          <ul className="space-y-3" aria-label="Past committees">
            {list.rows.map((p, i) => (
              <li key={`${p.name}-${i}`}>
                <Card>
                  <h2 className="text-[16.5px] font-bold">{p.name}</h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {shortDate(p.startDate)} to {shortDate(p.actualEndDate ?? p.endDate)}
                  </p>
                  {p.officeBearers.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[14px]">
                      {p.officeBearers.map((o, j) => (
                        <li key={j}>
                          <span className="font-semibold">{o.designationLabel || o.designation}:</span>{' '}
                          {o.name}
                          {o.fromDate || o.toDate
                            ? ` (${o.fromDate ? shortDate(o.fromDate) : '-'} to ${o.toDate ? shortDate(o.toDate) : '-'})`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          <Pager pagination={list.pagination} page={list.page} onPage={list.setPage} />
        </>
      )}
    </Page>
  );
}

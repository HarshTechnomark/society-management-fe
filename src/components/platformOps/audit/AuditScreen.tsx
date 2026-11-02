'use client';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { Card, Page, PageHead } from '@/components/common/PageHead';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { saveBlob } from '@/components/billing/format';
import { Tabs } from '@/components/societies/bits';
import { PERMISSIONS } from '@/constants/permissions';
import { useLoad } from '@/hooks/useLoad';
import { usePermission } from '@/hooks/usePermission';
import { useMe } from '@/lib/auth';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import type { AuditPage, AuditQuery, AuditRow } from '@/types/platformOps';
import { actorLabel, opsError, roleLabel, type AuditScope } from '../format';
import { ArchivesTab } from './ArchivesTab';
import { AuditDrawer } from './AuditDrawer';

const SOURCES: [string, string][] = [
  ['ADMIN_APP', 'Admin app'],
  ['RESIDENT_APP', 'Resident app'],
  ['GUARD_CONSOLE', 'Guard console'],
  ['STAFF_APP', 'Staff app'],
  ['API_KEY', 'API key'],
  ['SYSTEM_JOB', 'System job'],
  ['SUPPORT_ACCESS', 'Support access'],
  ['PLATFORM_CONSOLE', 'Platform console'],
];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Spec 11.7 Audit trail. `scope="platform"` is the platform console screen (society filter, IP column, Archives
 * tab); `scope="society"` is the admin app screen. Pages use the API cursor, never page numbers.
 */
export function AuditScreen({ scope }: { scope: AuditScope }) {
  const { ready } = useMe();
  const toast = useToast();
  const P = PERMISSIONS;
  const canView = usePermission(scope === 'platform' ? P.platform.auditLog.view : P.settings.auditLog.view);
  const canExport = usePermission(
    scope === 'platform' ? P.platform.auditLog.export : P.settings.auditLog.export,
  );
  const [tab, setTab] = useState<'log' | 'archives'>('log');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [societyId, setSocietyId] = useState('');
  const [societyText, setSocietyText] = useState('');
  const [societies, setSocieties] = useState<{ id: number; name: string }[]>([]);
  const [actorRole, setActorRole] = useState('');
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [more, setMore] = useState<{
    key: string;
    items: AuditRow[];
    cursor: string | null;
    hasMore: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim().length >= 2 ? text.trim() : ''), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (scope !== 'platform' || societyText.trim().length < 2) return;
    let live = true;
    const t = setTimeout(
      () =>
        svc.societySearch(societyText.trim()).then(
          r => live && setSocieties(r),
          () => undefined,
        ),
      300,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [societyText, scope]);

  const filters: AuditQuery = {
    ...(scope === 'platform' && societyId ? { societyId } : {}),
    ...(actorRole ? { actorRole } : {}),
    ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
    ...(action.trim() ? { action: action.trim() } : {}),
    ...(source ? { source } : {}),
    ...(q ? { q } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const key = JSON.stringify(filters);
  const fetchPage = (extra: AuditQuery = {}): Promise<AuditPage> =>
    (scope === 'platform' ? svc.platformAudit : svc.societyAudit)({ ...filters, limit: 20, ...extra });
  const first = useLoad(() => fetchPage(), key);

  const mine = more?.key === key ? more : null;
  const rows = [...(first.data?.items ?? []), ...(mine?.items ?? [])];
  const cursor = mine ? mine.cursor : (first.data?.nextCursor ?? null);
  const hasMore = mine ? mine.hasMore : !!first.data?.hasMore;

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const p = await fetchPage({ cursor });
      setMore({
        key,
        items: [...(mine?.items ?? []), ...p.items],
        cursor: p.nextCursor,
        hasMore: p.hasMore,
      });
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await (scope === 'platform' ? svc.exportPlatformAudit : svc.exportSocietyAudit)(filters);
      const end = to || isoDay(new Date());
      const start = from || isoDay(new Date(Date.now() - 30 * 86_400_000));
      saveBlob(blob, `${scope === 'platform' ? 'platform-audit' : 'audit-trail'}-${start}-${end}.csv`);
    } catch (e) {
      toast.show(opsError(e), 'error');
    } finally {
      setExporting(false);
    }
  };

  const any = Object.keys(filters).length > 0 || text !== '' || societyText !== '';
  const clear = () => {
    setText('');
    setSocietyId('');
    setSocietyText('');
    setActorRole('');
    setEntityType('');
    setAction('');
    setSource('');
    setFrom('');
    setTo('');
  };

  if (ready && !canView)
    return (
      <Page>
        <PageHead title="Audit trail" />
        <EmptyState title="You do not have access to the audit trail" />
      </Page>
    );

  const sources = scope === 'society' ? SOURCES.filter(s => s[0] !== 'PLATFORM_CONSOLE') : SOURCES;
  return (
    <Page>
      <PageHead
        title="Audit trail"
        sub="Who changed what, and when. Entries cannot be edited or deleted."
        actions={
          canExport &&
          tab === 'log' && (
            <Button variant="glass" size="sm" loading={exporting} onClick={exportCsv}>
              Export CSV
            </Button>
          )
        }
      />
      {scope === 'platform' && (
        <Tabs
          label="Audit sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'log', label: 'Audit trail' },
            { value: 'archives', label: 'Archives' },
          ]}
        />
      )}
      {tab === 'archives' ? (
        <ArchivesTab />
      ) : (
        <Card>
          <div className="mb-3 grid gap-3 min-[700px]:grid-cols-3">
            <Input
              label="Search"
              placeholder="Search action, entity or reason"
              type="search"
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {scope === 'platform' && (
              <>
                <Input
                  label="Find a society"
                  value={societyText}
                  onChange={e => setSocietyText(e.target.value)}
                />
                <Select
                  label="Society"
                  value={societyId}
                  onChange={e => setSocietyId(e.target.value)}
                  options={[
                    { value: '', label: 'All societies' },
                    { value: 'platform', label: 'Platform only' },
                    ...societies.map(s => ({ value: String(s.id), label: s.name })),
                  ]}
                />
              </>
            )}
            <Select
              label={scope === 'platform' ? 'Actor role' : 'Person'}
              value={actorRole}
              onChange={e => setActorRole(e.target.value)}
              options={[
                { value: '', label: scope === 'platform' ? 'All actors' : 'All people' },
                ...(scope === 'platform'
                  ? [['super_admin'], ['platform_support']]
                  : [['chairman'], ['secretary'], ['treasurer'], ['society_admin']]
                )
                  .concat([['system']])
                  .map(([v]) => ({ value: v, label: v === 'system' ? 'System' : roleLabel(v) })),
              ]}
            />
            <Input label="Entity type" value={entityType} onChange={e => setEntityType(e.target.value)} />
            <Input
              label="Action"
              hint="For example platform.society.* "
              value={action}
              onChange={e => setAction(e.target.value)}
            />
            <Select
              label="Source"
              value={source}
              onChange={e => setSource(e.target.value)}
              options={[
                { value: '', label: 'All sources' },
                ...sources.map(([v, l]) => ({ value: v, label: l })),
              ]}
            />
            <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {any && (
            <div className="mb-3">
              <Button size="xs" variant="ghost" onClick={clear}>
                Clear filters
              </Button>
            </div>
          )}
          {first.data?.archivedBefore && (
            <Alert tone="info">
              Older entries are archived.{' '}
              {scope === 'platform' && (
                <button type="button" className="underline" onClick={() => setTab('archives')}>
                  Open the Archives tab
                </button>
              )}
            </Alert>
          )}
          {first.error ? (
            <ErrorState
              error={first.error}
              title={opsError(first.error)}
              action={
                <button className="underline" onClick={first.reload}>
                  Try again
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[780px] border-collapse text-left text-[14px]"
                aria-busy={first.loading || undefined}
              >
                <caption className="sr-only">Audit trail</caption>
                <thead>
                  <tr className="border-b border-[var(--line)] text-[12px] font-semibold uppercase tracking-wide text-muted">
                    {[
                      'Time',
                      ...(scope === 'platform' ? ['Society'] : []),
                      'Actor',
                      'Action',
                      'Entity',
                      'Source',
                      ...(scope === 'platform' ? ['IP'] : []),
                    ].map(h => (
                      <th key={h} scope="col" className="px-3 py-2.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {first.loading
                    ? Array.from({ length: 5 }, (_, i) => (
                        <tr key={i} data-testid="skeleton-row">
                          <td colSpan={8} className="px-3 py-3.5">
                            <div className="skeleton h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    : rows.map(r => (
                        <tr
                          key={r.id}
                          className="cursor-pointer border-b border-[var(--line)] hover:bg-white/50"
                          onClick={() => setOpenId(r.id)}
                        >
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              className="text-left underline"
                              aria-label={`Open entry ${r.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                setOpenId(r.id);
                              }}
                            >
                              {new Date(r.createdAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </button>
                          </td>
                          {scope === 'platform' && (
                            <td className="px-3 py-3">{r.society?.name ?? 'Platform'}</td>
                          )}
                          <td className="px-3 py-3">
                            <div>{actorLabel(r, scope)}</div>
                            <div className="text-[12.5px] text-muted">{roleLabel(r.actor.role)}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-[12.5px]">{r.action}</td>
                          <td className="px-3 py-3">
                            <div>{r.entityLabel ?? r.entityId}</div>
                            <div className="text-[12.5px] text-muted">
                              {r.entityType} · {r.entityId}
                            </div>
                          </td>
                          <td className="px-3 py-3">{r.source}</td>
                          {scope === 'platform' && (
                            <td className="px-3 py-3 font-mono text-[12.5px]">{r.ip ?? '-'}</td>
                          )}
                        </tr>
                      ))}
                </tbody>
              </table>
              {!first.loading && rows.length === 0 && (
                <EmptyState title="No entries" text="Nothing matches these filters." />
              )}
            </div>
          )}
          {hasMore && (
            <div className="pt-3 text-center">
              <Button variant="glass" size="sm" loading={loadingMore} onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </Card>
      )}
      {openId !== null && <AuditDrawer id={openId} scope={scope} onClose={() => setOpenId(null)} />}
    </Page>
  );
}

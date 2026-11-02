'use client';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/common/ErrorState';
import { useLoad } from '@/hooks/useLoad';
import { platformOpsService as svc } from '@/services/platform-ops.service';
import { actorLabel, roleLabel, type AuditScope } from '../format';

const show = (v: unknown) =>
  v === undefined || v === null ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Row drawer: actor, entity, source, request id, reason and a Before and After table (changed rows highlighted). */
export function AuditDrawer({ id, scope, onClose }: { id: number; scope: AuditScope; onClose: () => void }) {
  const load = useLoad(() => (scope === 'platform' ? svc.platformAuditRow(id) : svc.societyAuditRow(id)), id);
  const r = load.data;
  const fields = r
    ? Array.from(new Set([...Object.keys(r.before ?? {}), ...Object.keys(r.after ?? {})]))
    : [];
  const facts: [string, string][] = r
    ? [
        ['Actor', `${actorLabel(r, scope)} (${roleLabel(r.actor.role)})`],
        ...(scope === 'platform' ? ([['Society', r.society?.name ?? 'Platform']] as [string, string][]) : []),
        ['Entity', `${r.entityLabel ?? r.entityId} (${r.entityType} · ${r.entityId})`],
        ['Source', r.source],
        ...(scope === 'platform' ? ([['IP', r.ip ?? '-']] as [string, string][]) : []),
        ['Request id', r.requestId ?? '-'],
        ['Reason', r.reason ?? '-'],
      ]
    : [];
  return (
    <Drawer open onClose={onClose} size={640} title={r ? r.action : 'Audit entry'}>
      {load.error ? (
        <ErrorState error={load.error} />
      ) : !r ? (
        <div className="skeleton h-40 w-full" />
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted">{new Date(r.createdAt).toLocaleString('en-IN')}</p>
          <dl className="mb-4 grid gap-2 text-[14px]">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {fields.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13.5px]">
                <caption className="mb-1 text-left text-[14px] font-bold">Changes</caption>
                <thead>
                  <tr className="text-[12px] uppercase text-muted">
                    <th scope="col" className="px-2 py-1">
                      Field
                    </th>
                    <th scope="col" className="px-2 py-1">
                      Before
                    </th>
                    <th scope="col" className="px-2 py-1">
                      After
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => {
                    const changed = show(r.before?.[f]) !== show(r.after?.[f]);
                    return (
                      <tr
                        key={f}
                        data-changed={changed || undefined}
                        className={changed ? 'bg-[rgba(201,169,97,0.22)]' : ''}
                      >
                        <th scope="row" className="px-2 py-1 font-mono text-[12.5px] font-semibold">
                          {f}
                        </th>
                        <td className="px-2 py-1 break-all">{show(r.before?.[f])}</td>
                        <td className="px-2 py-1 break-all">{show(r.after?.[f])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

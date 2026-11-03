import { Alert } from '@/components/ui/Alert';
import { Chip } from '@/components/ui/Chip';
import type { Plan, PlanAction, PlanIssue } from '@/types/committee';
import { BLOCKER_FIX, roleLabel } from './format';

type Group = 'JOINING' | 'CONTINUING' | 'LEAVING';
const GROUP_TITLE: Record<Group, string> = {
  JOINING: 'Joining',
  CONTINUING: 'Continuing',
  LEAVING: 'Leaving',
};

const groupOf = (a: PlanAction): Group => {
  if (a.kind === 'END_MEMBERSHIP') return 'LEAVING';
  if (a.reason === 'OUTGOING') return 'LEAVING';
  if (a.reason === 'INCOMING') return 'JOINING';
  return 'CONTINUING';
};

/** "Treasurer → Owner" for one action, with the words "no change" when the role stays. */
export function roleChange(a: PlanAction): { from: string; to: string; same: boolean; text: string } {
  if (a.kind === 'NONE') {
    const r = roleLabel(a.roleKey);
    return { from: r, to: r, same: true, text: `${r}, no role change` };
  }
  if (a.kind === 'END_MEMBERSHIP') {
    const f = roleLabel(a.fromRoleKey);
    return { from: f, to: 'Membership ends', same: false, text: `${f} → Membership ends` };
  }
  const f = roleLabel(a.fromRoleKey);
  const t = roleLabel(a.toRoleKey);
  return a.fromRoleKey === a.toRoleKey
    ? { from: f, to: t, same: true, text: `${f}, no role change` }
    : { from: f, to: t, same: false, text: `${f} → ${t}` };
}

const seatEffect = (a: PlanAction) => (a.kind === 'NONE' ? 0 : a.seatDelta);

/** Who and what a blocker or warning is about: seat holders, people and the access that is missing. */
function issueDetail(plan: Plan, b: PlanIssue): string {
  const seat = (id: string) => plan.seats.find(s => s.seatId === id)?.name ?? id;
  const user = (id: number) => plan.actions.find(a => a.userId === id)?.name;
  const names = [...b.seatIds.map(seat), ...b.userIds.map(user).filter((x): x is string => !!x)];
  const parts: string[] = [];
  if (names.length) parts.push(`For: ${[...new Set(names)].join(', ')}.`);
  if (b.permissionKeys.length) parts.push(`Access you do not have: ${b.permissionKeys.join(', ')}.`);
  return parts.join(' ');
}

function Issues({
  plan,
  items,
  kind,
  verb = 'activate',
}: {
  plan: Plan;
  items: PlanIssue[];
  kind: 'blocker' | 'warning';
  verb?: 'activate' | 'apply';
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4" data-testid={kind === 'blocker' ? 'plan-blockers' : 'plan-warnings'}>
      {items.map((b, i) => (
        <Alert key={`${b.code}-${i}`} tone={kind === 'blocker' ? 'bad' : 'warn'} className="!mb-2">
          <span>
            <strong>{kind === 'blocker' ? `Cannot ${verb} yet: ` : 'Note: '}</strong>
            {b.message}
            {issueDetail(plan, b) && <span className="block">{issueDetail(plan, b)}</span>}
            {kind === 'blocker' && BLOCKER_FIX[b.code] && (
              <span className="block font-semibold">How to fix: {BLOCKER_FIX[b.code]}</span>
            )}
          </span>
        </Alert>
      ))}
    </div>
  );
}

/**
 * The preview plan shared by the activation wizard (spec 11.4 step 1) and the make-changes dialog (11.5):
 * blockers, warnings, the people grouped as Joining, Continuing and Leaving with "role now → role after",
 * the staff seat effect (only when it moves), and the hand-over delegations. Status is always in words.
 */
export function PlanView({ plan, verb = 'activate' }: { plan: Plan; verb?: 'activate' | 'apply' }) {
  const groups = (['JOINING', 'CONTINUING', 'LEAVING'] as Group[])
    .map(g => ({ g, items: plan.actions.filter(a => groupOf(a) === g) }))
    .filter(x => x.items.length > 0);
  const staffMoves = plan.staffSeats.delta !== 0 || plan.actions.some(a => seatEffect(a) !== 0);
  const { limit, used, delta } = plan.staffSeats;
  return (
    <div>
      <Issues plan={plan} items={plan.blockers} kind="blocker" verb={verb} />
      <Issues plan={plan} items={plan.warnings} kind="warning" />
      {groups.length === 0 && <p className="text-[14px] text-muted">No role changes are needed.</p>}
      {groups.map(({ g, items }) => (
        <section key={g} aria-label={GROUP_TITLE[g]} className="mb-4">
          <h3 className="mb-1.5 text-[14px] font-bold">
            {GROUP_TITLE[g]} <span className="font-normal text-muted">({items.length})</span>
          </h3>
          <ul className="divide-y divide-[var(--line)] rounded-[14px] border border-[var(--line)] bg-white/60">
            {items.map(a => {
              const c = roleChange(a);
              const eff = seatEffect(a);
              return (
                <li
                  key={`${a.userId}-${a.kind}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
                  data-testid="plan-row"
                >
                  <span className="min-w-0 font-semibold">{a.name}</span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
                    {c.same ? (
                      <>
                        <span>{c.from}</span>
                        <Chip>No role change</Chip>
                      </>
                    ) : (
                      <>
                        <span className="text-muted">{c.from}</span>
                        <span aria-hidden="true">→</span>
                        <span className="sr-only">changes to</span>
                        <span className="font-semibold">{c.to}</span>
                        <Chip tone="gold">Role change</Chip>
                      </>
                    )}
                    {eff !== 0 && (
                      <Chip tone="info">{eff < 0 ? 'Frees a staff seat' : 'Uses a staff seat'}</Chip>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {staffMoves && (
        <p className="mb-4 text-[14px]" data-testid="plan-staff-seats">
          <span className="font-semibold">Staff seats: </span>
          {used} → {used + delta}
          {limit !== null ? ` of ${limit}` : ''}
          {delta === 0 ? ' (no change)' : delta < 0 ? ' (one released)' : ' (one used)'}
        </p>
      )}
      {plan.handoverDelegations.length > 0 && (
        <section aria-label="Hand-over of approvals" className="mb-2" data-testid="plan-handover">
          <h3 className="mb-1.5 text-[14px] font-bold">Hand-over of approvals</h3>
          <ul className="list-disc space-y-1 pl-5 text-[14px]">
            {plan.handoverDelegations.map((d, i) => (
              <li key={i}>
                {d.toName} can act on approvals waiting on {d.fromName} for {d.days} days.
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

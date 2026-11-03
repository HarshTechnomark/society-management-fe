import { Avatar } from '@/components/access/Avatar';
import { Chip } from '@/components/ui/Chip';
import { shortDate } from '@/lib/money';
import type { Seat } from '@/types/committee';
import { EXIT_LABEL, FLAG_LABEL, JOIN_LABEL, PORTFOLIO_LABEL, designationLabel } from './format';

/** One seat: initials, name, designation, how they joined, flat, portfolios, masked mobile, flags (spec 11.2). */
export function SeatCard({ seat, history }: { seat: Seat; history?: boolean }) {
  return (
    <li className="glass flex gap-3 p-3.5" data-testid="seat-card">
      <Avatar name={seat.name} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{seat.name}</p>
        <p className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="gold">{designationLabel(seat.designation)}</Chip>
          <Chip>{JOIN_LABEL[seat.joinMode] ?? seat.joinMode}</Chip>
          {seat.status === 'PLANNED' && <Chip tone="info">Planned</Chip>}
          {seat.flags.map(f => (
            <Chip key={f} tone="warn">
              Check: {FLAG_LABEL[f] ?? f}
            </Chip>
          ))}
        </p>
        <p className="mt-1.5 text-[13px] text-muted">
          {[seat.unitLabel ? `Flat ${seat.unitLabel}` : null, seat.mobile, seat.publicEmail]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {seat.portfolios.length > 0 && (
          <p className="mt-1 text-[13px] text-muted">
            {seat.portfolios.map(p => PORTFOLIO_LABEL[p] ?? p).join(', ')}
          </p>
        )}
        {history && (
          <p className="mt-1 text-[13px] text-muted">
            {seat.fromDate ? shortDate(seat.fromDate) : '-'} to {seat.toDate ? shortDate(seat.toDate) : 'now'}
            {seat.status === 'LEFT' && seat.exitReason
              ? ` · ${EXIT_LABEL[seat.exitReason] ?? seat.exitReason}${seat.exitNote ? `: ${seat.exitNote}` : ''}`
              : ''}
          </p>
        )}
      </div>
    </li>
  );
}

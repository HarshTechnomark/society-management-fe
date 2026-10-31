/** "Admin seats": staff accounts used against the plan limit (BR-03-33). The limit is shown when known. */
export function SeatMeter({ used, limit }: { used: number; limit?: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const full = !!limit && used >= limit;
  return (
    <div className="flex min-w-[200px] flex-col gap-1" data-testid="seat-meter">
      <span className="text-[13px] font-semibold">
        {limit ? `Admin seats: ${used} of ${limit} used` : `Admin seats in use: ${used}`}
      </span>
      {limit ? (
        <div
          role="progressbar"
          aria-label="Admin seats used"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="h-2 overflow-hidden rounded-full bg-[rgba(20,35,44,0.12)]"
        >
          <div
            className={`h-full rounded-full ${full ? 'bg-bad' : 'bg-navy'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      <span className="text-[12px] text-muted">Committee roles do not use a seat.</span>
    </div>
  );
}

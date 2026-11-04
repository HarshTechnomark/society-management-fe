import { useId, type ReactNode } from 'react';
import { Button, type ButtonSize } from '@/components/ui/Button';

/** Shown under a pay button until online payment (module 12) ships: the `/pay` route does not exist yet. */
export const PAY_LATER_TEXT = 'Online payment comes with the payments update.';

/**
 * A disabled pay button with a short note under it. It keeps the button's place in the layout until module 12 adds
 * the pay route; then the button becomes a link again.
 */
export function PayLater({
  children,
  label,
  size = 'md',
}: {
  children: ReactNode;
  /** Accessible name when the visible text is not enough (for example "Pay dues of C-0801"). */
  label?: string;
  size?: ButtonSize;
}) {
  const noteId = useId();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size={size} disabled aria-label={label} aria-describedby={noteId}>
        {children}
      </Button>
      <span id={noteId} className="text-[12px] text-muted">
        {PAY_LATER_TEXT}
      </span>
    </span>
  );
}

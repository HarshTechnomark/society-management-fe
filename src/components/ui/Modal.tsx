'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** A sticky modal ignores Esc and outside clicks (used while a one-time secret is on screen). */
  sticky?: boolean;
  description?: string;
  /** A wider panel on desktop (wizards); still a full-width bottom sheet on phones. */
  wide?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centred dialog on desktop, bottom sheet at 700 px or less (CSS). Traps focus, restores it on close,
 * closes on Esc unless `sticky`, locks page scroll.
 */
export function Modal({ open, onClose, title, children, footer, sticky, description, wide }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current!;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    // Focus the first field if there is one, else the first control, else the panel itself.
    (
      node.querySelector<HTMLElement>('[data-autofocus], input, select, textarea') ??
      items()[0] ??
      node
    ).focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sticky) {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const list = items();
        if (list.length === 0) {
          e.preventDefault();
          return;
        }
        const first = list[0];
        const last = list[list.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === node)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!node.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, sticky]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,37,51,0.45)] p-4 max-[700px]:items-end max-[700px]:p-0"
      data-testid="modal-overlay"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !sticky) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-sheet="responsive"
        className={cx(
          'modal-panel flex max-h-[90vh] w-full flex-col rounded-[28px] border border-white/80 bg-[rgba(251,247,240,0.98)] shadow-2xl',
          wide ? 'max-w-[640px]' : 'max-w-[480px]',
          'max-[700px]:max-w-none max-[700px]:rounded-b-none',
        )}
      >
        <div className="overflow-y-auto p-6 max-[700px]:p-5">
          <h2 id={titleId} className="mb-1 text-[20px] font-bold tracking-tight">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mb-4 text-[14px] text-muted">
              {description}
            </p>
          )}
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--line)] p-4 max-[700px]:sticky max-[700px]:bottom-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

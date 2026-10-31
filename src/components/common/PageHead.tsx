import type { ReactNode } from 'react';

/** Page title, one-line sub text and the page's main buttons (prototype `pageHead`). */
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold tracking-tight max-[700px]:text-[22px]">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A glass card with an optional heading. */
export function Card({
  title,
  sub,
  children,
  className = '',
}: {
  title?: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3">
          <h2 className="text-[17px] font-bold">{title}</h2>
          {sub && <p className="text-[13px] text-muted">{sub}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Page content width and padding shared by the module 03 screens. */
export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1100px] px-4 py-5 sm:px-6 sm:py-8">{children}</main>;
}

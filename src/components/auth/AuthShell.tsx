'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { APP_LABEL, useClientApp } from '@/lib/clientApp';
import { cx } from '@/components/ui/cx';

export const linkClass =
  'font-semibold text-navy underline decoration-gold decoration-2 underline-offset-[3px] hover:text-black';

const COPY: Record<string, { title: string; text: string; points: string[] }> = {
  ADMIN: {
    title: 'Run your society from your phone.',
    text: 'Collect maintenance and festival contributions, approve expenses, handle building issues and keep every resident informed, from one app.',
    points: [
      'Every payment lands in the live society balance',
      'Two-step sign-in and maker-checker approvals',
      'Notices, complaints and building issues in one place',
    ],
  },
  PLATFORM: {
    title: 'The SocietyApp console.',
    text: 'Manage societies, plans and support from one place, with two-step sign-in on every account.',
    points: [
      'Two-step sign-in is always on',
      'Support access is time-boxed and audited',
      'One console for every society',
    ],
  },
  RESIDENT: {
    title: 'Your home, in your pocket.',
    text: 'Pay dues, let visitors in, raise issues and stay close to your community.',
    points: [
      'Pay maintenance in a few taps',
      'Approve visitors from your phone',
      'Notices and help in one place',
    ],
  },
  GATE: {
    title: 'Fast and safe at the gate.',
    text: 'Log visitors, check passes and keep the register in order.',
    points: ['Large buttons for busy shifts', 'Works with patchy network', 'Every entry recorded'],
  },
  WORK: {
    title: 'Your tasks for today.',
    text: 'See your jobs, update their status and stay in touch with the society office.',
    points: ['One list of tasks', 'Update from your phone', 'Clear instructions for every visit'],
  },
};

function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

/** The shared brand panel (desktop) and small brand header (phone) around every public screen. */
export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const app = useClientApp();
  const copy = COPY[app];
  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] p-5 max-[1000px]:grid-cols-1 max-[1000px]:p-3">
      <section className="relative mr-5 flex flex-col justify-between overflow-hidden rounded-[30px] bg-[radial-gradient(90%_70%_at_20%_0%,rgba(201,169,97,0.45),rgba(201,169,97,0)_60%),linear-gradient(160deg,#1D4358_0%,#0E2533_70%)] p-11 text-[#F6EEDC] max-[1000px]:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <Logo />
          </span>
          <div className="leading-tight">
            <b className="block text-[#FDF8EE]">SocietyApp</b>
            <span className="text-[11px] tracking-widest text-[#B9B29E]">{APP_LABEL[app]}</span>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="my-8 mb-3.5 max-w-[440px] text-[38px] font-bold leading-[1.12] tracking-[-0.035em]">
            {copy.title}
          </h2>
          <p className="max-w-[420px] text-[15.5px] text-[#D3CBB6]">{copy.text}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {copy.points.map(p => (
              <li key={p} className="flex items-center gap-3 text-[14.5px] text-[#EDE5D0]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#E9D6A8]" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 text-[12.5px] text-[#B9B29E]">societyapp.in</div>
      </section>
      <main id="main" className="flex items-center justify-center p-5 max-[700px]:px-4 max-[700px]:py-4">
        <div
          className={cx(
            'glass w-full rounded-[30px] bg-[var(--glass-2)] p-[34px] pb-7 max-[700px]:p-5',
            wide ? 'max-w-[560px]' : 'max-w-[460px]',
          )}
        >
          <div className="mb-5 flex items-center gap-2.5 min-[1001px]:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-[#FDF8EE]">
              <Logo />
            </span>
            <div className="leading-tight">
              <b className="block">SocietyApp</b>
              <span className="text-[11px] tracking-widest text-muted">{APP_LABEL[app]}</span>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <>
      <h1 className="mb-1.5 text-[28px] font-bold tracking-[-0.03em] max-[700px]:text-[24px]">{title}</h1>
      {lead && <p className="mb-5 text-muted">{lead}</p>}
    </>
  );
}

export function BackLink({ href, children = 'Back' }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className={cx(linkClass, 'mb-4 inline-block text-[14px]')}>
      {'< '}
      {children}
    </Link>
  );
}

export function Divider({ children = 'or' }: { children?: ReactNode }) {
  return (
    <div
      className="my-4 flex items-center gap-3 text-[12.5px] font-semibold text-[var(--faint)]"
      role="separator"
    >
      <span className="flex-1 border-t border-[var(--line)]" />
      {children}
      <span className="flex-1 border-t border-[var(--line)]" />
    </div>
  );
}

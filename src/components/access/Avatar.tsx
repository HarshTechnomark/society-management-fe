import { initials } from './format';

export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(201,169,97,0.32)] text-[13px] font-bold text-gold-ink"
    >
      {initials(name)}
    </span>
  );
}

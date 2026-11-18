'use client';
import { useEffect, useId, useRef } from 'react';
import { cx } from '@/components/ui/cx';

const TOOLS: { label: string; cmd: string; arg?: string; text: string }[] = [
  { label: 'Bold', cmd: 'bold', text: 'B' },
  { label: 'Italic', cmd: 'italic', text: 'I' },
  { label: 'Heading', cmd: 'formatBlock', arg: 'h3', text: 'H' },
  { label: 'Bulleted list', cmd: 'insertUnorderedList', text: '• List' },
];

/** The message box: a small rich text editor (bold, italic, heading, list, link) that reports HTML. */
export function RichTextField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (html: string) => void;
  error?: string | null;
  hint?: string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);
  const run = (cmd: string, arg?: string) => {
    box.current?.focus();
    if (typeof document.execCommand === 'function') document.execCommand(cmd, false, arg);
    if (box.current) onChange(box.current.innerHTML);
  };
  const link = () => {
    const url = window.prompt('Link address (starts with https://)');
    if (url && /^https:\/\//i.test(url)) run('createLink', url);
  };
  return (
    <div className="mb-4">
      <span id={`${id}-label`} className="mb-1.5 block text-[13px] font-semibold">
        {label}
      </span>
      <div role="toolbar" aria-label="Formatting" className="mb-1.5 flex flex-wrap gap-1">
        {TOOLS.map(t => (
          <button
            key={t.label}
            type="button"
            aria-label={t.label}
            onMouseDown={e => e.preventDefault()}
            onClick={() => run(t.cmd, t.arg)}
            className="h-8 min-w-8 rounded-lg bg-white/60 px-2 text-[13px] font-bold hover:bg-white/90"
          >
            {t.text}
          </button>
        ))}
        <button
          type="button"
          aria-label="Link"
          onMouseDown={e => e.preventDefault()}
          onClick={link}
          className="h-8 min-w-8 rounded-lg bg-white/60 px-2 text-[13px] font-bold hover:bg-white/90"
        >
          Link
        </button>
      </div>
      <div
        id={id}
        ref={box}
        role="textbox"
        aria-labelledby={`${id}-label`}
        aria-multiline="true"
        aria-invalid={error ? true : undefined}
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        className={cx(
          'min-h-[140px] w-full rounded-[16px] border-[1.5px] bg-white/80 px-4 py-3 text-[15px] text-ink',
          'focus:border-navy focus:bg-white focus:outline-none focus:ring-4 focus:ring-[rgba(20,48,65,0.12)]',
          error ? 'border-bad' : 'border-[rgba(20,35,44,0.16)]',
        )}
      />
      {hint && !error && <p className="mt-1.5 text-[12.5px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

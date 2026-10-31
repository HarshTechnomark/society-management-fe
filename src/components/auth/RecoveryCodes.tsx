'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

/** Ten one-time codes in two columns, with Copy and Download. Codes exist only in memory. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([`SocietyApp recovery codes\n\n${text}\n`], { type: 'text/plain' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <ul
        aria-label="Recovery codes"
        className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/70 p-4 font-mono text-[14px] font-semibold"
      >
        {codes.map(c => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mb-3 flex gap-2">
        <Button variant="glass" size="sm" onClick={copy}>
          Copy
        </Button>
        <Button variant="glass" size="sm" onClick={download}>
          Download
        </Button>
      </div>
      {copied && <Alert tone="ok">Copied to the clipboard.</Alert>}
    </div>
  );
}

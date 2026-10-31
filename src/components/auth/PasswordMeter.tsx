import { passwordRules, passwordStrength } from '@/lib/validation';
import { cx } from '@/components/ui/cx';

const LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const COLOR = ['', 'bg-bad', 'bg-warn', 'bg-info', 'bg-ok'];

/** Four-bar strength meter and the live list of the six password rules (BR-02-13). */
export function PasswordMeter({ password, email }: { password: string; email?: string }) {
  const s = passwordStrength(password, email);
  const rules = passwordRules(password, email);
  return (
    <div className="-mt-1 mb-4">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map(i => (
          <span
            key={i}
            className={cx('h-1.5 flex-1 rounded-full', i <= s ? COLOR[s] : 'bg-[rgba(20,35,44,0.12)]')}
          />
        ))}
      </div>
      <p className="mt-1 text-[12.5px] font-semibold text-muted" aria-live="polite">
        Strength: {s ? LABEL[s] : 'enter a password'}
      </p>
      <ul className="mt-1.5 grid gap-1 text-[13px]" aria-label="Password rules">
        {rules.map(r => (
          <li key={r.key} className={r.ok ? 'text-ok' : 'text-muted'}>
            <span aria-hidden="true">{r.ok ? '✓ ' : '○ '}</span>
            {r.text}
            <span className="sr-only">{r.ok ? ' (met)' : ' (not met)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

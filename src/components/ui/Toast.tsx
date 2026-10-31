'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

type ToastTone = 'success' | 'warning' | 'error';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}
interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });
export const useToast = () => useContext(Ctx);

const TONE: Record<ToastTone, string> = {
  success: 'bg-[#14583a] text-white',
  warning: 'bg-[#6f4200] text-white',
  error: 'bg-[#8a1d17] text-white',
};

/** Bottom right on desktop, bottom centre on phones; each toast lasts 4 seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setItems(list => [...list, { id, tone, message }]);
    timers.current.push(window.setTimeout(() => setItems(list => list.filter(t => t.id !== id)), 4000));
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-[700px]:inset-x-4 max-[700px]:bottom-20 max-[700px]:right-auto"
      >
        {items.map(t => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto rounded-[14px] px-4 py-3 text-[14px] font-medium shadow-lg',
              TONE[t.tone],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

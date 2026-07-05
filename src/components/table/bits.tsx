'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const ARM_MS = 4000;

/** Подвійний тап: перший «озброює» на 4с, другий виконує. */
export function useArmed(ms = ARM_MS) {
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const fire = useCallback((fn: () => void) => {
    if (t.current) clearTimeout(t.current);
    if (armedRef.current) {
      armedRef.current = false; setArmed(false);
      fn();
    } else {
      armedRef.current = true; setArmed(true);
      t.current = setTimeout(() => { armedRef.current = false; setArmed(false); }, ms);
    }
  }, [ms]);
  return [armed, fire] as const;
}

/** Нік з мʼякими точками переносу після «_» (+ опційне зменшення за довжиною). */
export function NickFit({ nick, shrink = true }: { nick: string; shrink?: boolean }) {
  const size = !shrink || nick.length <= 8 ? 1 : nick.length <= 12 ? 0.82 : 0.68;
  return (
    <span style={size !== 1 ? { fontSize: `${Math.round(size * 100)}%` } : undefined}>
      {nick.split('_').map((part, i, arr) => (
        <span key={i}>{part}{i < arr.length - 1 ? <>_<wbr /></> : null}</span>
      ))}
    </span>
  );
}

/** Крафтовий вогник для стріку (заміна емодзі 🔥) — 2-шарова силует-іскра. */
export function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2c1 3-2.5 4-2.5 7.2 0 1.3.8 2 1.7 2-.6-1.4.2-2.6 1-3.6.3 1 .9 1.7.9 2.9 0 2-1.6 3.1-1.6 3.1s3.9-.7 3.9-4.9C15.4 6.4 11 6 12 2Z"
        fill="currentColor" />
      <path d="M9.3 12.4c-1.7 1.5-2.3 3-2.3 4.4 0 3 2.2 5.2 5 5.2s5-2.2 5-5c0-1.6-.9-2.8-1.7-3.7.2 1.7-.9 2.9-2.1 2.9-1.1 0-1.9-.8-1.9-1.9 0-.9.5-1.4 1-1.9-1.6.1-2.5-.1-3-.1Z"
        fill="currentColor" opacity=".55" />
    </svg>
  );
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { leagueOf } from '@/lib/table/elo';

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

/**
 * Нік з мʼякими точками переносу після «_» (+ опційне зменшення за довжиною).
 * `oneLine` — жорстко один рядок: спершу зменшення шрифту, далі «…» (жодних
 * переносів посеред слова — лікує колапс колонки в лідерборді на телефоні).
 */
export function NickFit({ nick, shrink = true, oneLine = false }: {
  nick: string; shrink?: boolean; oneLine?: boolean;
}) {
  const size = !shrink || nick.length <= 7 ? 1 : nick.length <= 11 ? 0.84 : 0.68;
  const style = size !== 1 ? { fontSize: `${Math.round(size * 100)}%` } : undefined;
  if (oneLine) return <span className="k-oneline" style={style}>{nick}</span>;
  return (
    <span style={style}>
      {nick.split('_').map((part, i, arr) => (
        <span key={i}>{part}{i < arr.length - 1 ? <>_<wbr /></> : null}</span>
      ))}
    </span>
  );
}

/**
 * Крафтові медалі ліг — 5 різних інлайн-SVG у Memphis-стилі (токени палітри,
 * жодних емодзі). НОВАЧОК: лаймовий значок-кнопка з іскрою-трикутником;
 * БОЄЦЬ: бірюзовий щит із шевроном; ПРОФІ: синій гекс-жетон із блискавкою;
 * МАЙСТЕР: фіолетова корона з самоцвітом; ЛЕГЕНДА: жовта 8-промінна розетка
 * з рожевим серцем.
 */
export function LeagueMedal({ rating, size = 20, className }: {
  rating: number; size?: number; className?: string;
}) {
  const common = {
    className, width: size, height: size,
    viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const,
  };
  switch (leagueOf(rating).name) {
    case 'ЛЕГЕНДА':
      return (
        <svg {...common}>
          <path d="M12 2 14.3 6.46 19.07 4.93 17.54 9.7 22 12 17.54 14.3 19.07 19.07 14.3 17.54 12 22 9.7 17.54 4.93 19.07 6.46 14.3 2 12 6.46 9.7 4.93 4.93 9.7 6.46Z"
            fill="var(--yellow)" stroke="var(--line)" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3.4" fill="var(--pink)" stroke="var(--line)" strokeWidth="1.6" />
        </svg>
      );
    case 'МАЙСТЕР':
      return (
        <svg {...common}>
          <path d="M3.4 7.2 8.2 11.3 12 5.2l3.8 6.1 4.8-4.1-1.9 11.4H5.3Z"
            fill="var(--purple)" stroke="var(--line)" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="14.4" r="1.8" fill="var(--yellow)" stroke="var(--line)" strokeWidth="1.3" />
        </svg>
      );
    case 'ПРОФІ':
      return (
        <svg {...common}>
          <path d="M12 1.8 20.6 6.9v10.2L12 22.2 3.4 17.1V6.9Z"
            fill="var(--blue)" stroke="var(--line)" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13.6 5.6 8.2 13.1h3.1l-1 5.3 5.5-7.6h-3.2Z"
            fill="var(--yellow)" stroke="var(--line)" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      );
    case 'БОЄЦЬ':
      return (
        <svg {...common}>
          <path d="M12 2.2 20 5.2v6.3c0 5-3.3 8.6-8 10.3-4.7-1.7-8-5.3-8-10.3V5.2Z"
            fill="var(--cyan)" stroke="var(--line)" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="m7.8 10.4 4.2 4 4.2-4" stroke="var(--line)" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default: /* НОВАЧОК */
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.4" fill="var(--lime)" stroke="var(--line)" strokeWidth="1.8" />
          <path d="M12 7.2 16.4 15H7.6Z" fill="var(--bg)" stroke="var(--line)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
  }
}

/** Компактний чип рейтингу: медаль ліги + число (VS-картки, пікер). */
export function RatingChip({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={'k-rate-chip' + (className ? ' ' + className : '')}>
      <LeagueMedal rating={rating} size={15} />
      <b>{rating}</b>
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

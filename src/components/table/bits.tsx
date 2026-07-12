'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { leagueOf } from '@/lib/table/elo';
import type { Title } from '@/lib/table/types';

const ARM_MS = 4000;

/** «виграв/виграла» за статтю героя; стать не вказана — універсальне «виграв(ла)». */
export function byGender(
  p: { hero?: { gender?: string } } | null | undefined,
  m: string, f: string, u?: string
): string {
  const g = p?.hero?.gender;
  return g === 'female' ? f : g === 'male' ? m : (u ?? `${m}(ла)`);
}

/**
 * Подвійний тап: перший «озброює» на 4с, другий виконує.
 * Тап будь-де ПОЗА кнопкою знімає озброєння одразу (фідбек клубу: click-out) —
 * третім елементом повертається ref, який вішається на кнопку.
 */
export function useArmed(ms = ARM_MS) {
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  useEffect(() => {
    if (!armed) return;
    const onDown = (e: PointerEvent) => {
      // тап по самій кнопці обробляє fire(); все інше — збиває «Точно?»
      if (btnRef.current && e.target instanceof Node && btnRef.current.contains(e.target)) return;
      if (t.current) clearTimeout(t.current);
      armedRef.current = false; setArmed(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [armed]);
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
  return [armed, fire, btnRef] as const;
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

/**
 * Стрілка руху в топі за добу: ↑N лайм / ↓N корал / нейтральна крапка при 0 /
 * нічого при null (гравця ще не було в топі добу тому). Крафтова SVG-стрілка.
 */
export function MoveChip({ move }: { move: number | null }) {
  if (move == null) return null;
  if (move === 0) return <span className="k-move zero" aria-label="позиція без змін" />;
  const up = move > 0;
  return (
    <span className={'k-move ' + (up ? 'up' : 'down')}
      aria-label={up ? `піднявся на ${move}` : `опустився на ${-move}`}>
      <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 1.2 11 7.4 H8.2 V10.8 H3.8 V7.4 H1 Z" fill="currentColor"
          stroke="currentColor" strokeWidth=".8" strokeLinejoin="round" />
      </svg>
      {Math.abs(move)}
    </span>
  );
}

/** Форма: до 5 останніх ігор, найновіша ПЕРША. W — заливка лаймом, L — контур. */
export function FormDots({ form }: { form: string }) {
  if (!form) return null;
  return (
    <span className="k-form" aria-label={`форма (нові зліва): ${form}`}>
      {form.slice(0, 5).split('').map((c, i) => (
        <i key={i} className={c === 'W' ? 'w' : 'l'} />
      ))}
    </span>
  );
}

export const TITLE_LABEL: Record<Title, string> = {
  giant: 'ГІГАНТ-ВБИВЦЯ',
  comeback: 'КАМБЕК',
  marathon: 'МАРАФОНЕЦЬ',
  lightning: 'БЛИСКАВКА',
};

/**
 * Крафтові SVG-іконки титулів (жодних емодзі), різні силуети:
 * giant — сокира (коралове лезо + руків'я), comeback — петля-стрілка вгору,
 * marathon — крилатий кросівок, lightning — блискавка в жовтому колі.
 */
export function TitleIcon({ title, size = 18 }: { title: Title; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', 'aria-hidden': true as const,
  };
  switch (title) {
    case 'giant':
      return (
        <svg {...common}>
          <path d="M11.6 7.4 4.6 21" stroke="var(--line)" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M9.2 3.1c3.8-1.6 8.3-.8 11.3 2.2-1.6 4.2-5.1 7-9.5 7.5C9.6 9.8 8.8 6.5 9.2 3.1Z"
            fill="var(--coral)" stroke="var(--line)" strokeWidth="1.9" strokeLinejoin="round" />
        </svg>
      );
    case 'comeback':
      return (
        <svg {...common}>
          <path d="M3.8 5.6c-1 6.4 2.1 13.6 8.2 13.6 4.6 0 7.5-3.4 8-8.8"
            stroke="var(--purple)" strokeWidth="3" strokeLinecap="round" />
          <path d="M20 2.6 16.4 8.8h7.2Z" fill="var(--purple)" stroke="var(--line)"
            strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
    case 'marathon':
      return (
        <svg {...common}>
          <path d="M12.6 9.4c2.2-3.4 5.6-5 9-4.8-1.8 2.6-4.6 4.4-7.8 4.9Z"
            fill="var(--cyan)" stroke="var(--line)" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M3.2 16.8c3.6-.8 5.8-3 7-6l3.4 2.6c3.2.2 6 1.2 7.2 3.2l-.4 2.4H3.4Z"
            fill="var(--yellow)" stroke="var(--line)" strokeWidth="1.9" strokeLinejoin="round" />
        </svg>
      );
    case 'lightning':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="var(--yellow)" stroke="var(--line)" strokeWidth="1.9" />
          <path d="M13.6 4.6 7.2 13.2h3.4L9.4 19.6l6.4-8.8h-3.4Z"
            fill="var(--pink)" stroke="var(--line)" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      );
  }
}

/** Титул як чип: іконка + коротка назва (лейбл ховається на телефоні через CSS). */
export function TitleChip({ title, size = 18 }: { title: Title; size?: number }) {
  return (
    <span className={'k-title t-' + title} title={TITLE_LABEL[title]}>
      <TitleIcon title={title} size={size} />
      <em>{TITLE_LABEL[title]}</em>
    </span>
  );
}

/** Корона №1 подіуму — жовта, з рожевим самоцвітом (крафт, не емодзі). */
export function PodiumCrown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 84 56" fill="none" aria-hidden="true">
      <path d="M6 46 3 12l21 15L42 5l18 22 21-15-3 34Z"
        fill="var(--yellow)" stroke="var(--line)" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="42" cy="34" r="5.5" fill="var(--pink)" stroke="var(--line)" strokeWidth="3" />
    </svg>
  );
}

/**
 * Бейдж «АПСЕТ» — рожевий зубчастий вибух під текстом (перемога андердога).
 * В'їжджає один раз із трусом; дві зірочки-іскри (CSS clip-path, не емодзі)
 * спалахують і гаснуть — анімації разові, з prefers-reduced-motion вимкнені.
 */
export function UpsetChip() {
  return (
    <span className="k-upset" aria-label="апсет: переміг андердог">
      <svg viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="60.0,2.0 72.7,10.0 90.8,5.2 94.0,13.8 111.8,13.7 104.5,20.2 116.4,24.8 100.9,27.2 103.1,35.1 84.3,32.5 76.1,41.2 60.0,34.5 43.9,41.2 35.7,32.5 16.9,35.1 19.1,27.2 3.6,24.8 15.5,20.2 8.2,13.7 26.0,13.8 29.2,5.2 47.3,10.0"
          fill="var(--pink)" stroke="var(--line)" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <em>АПСЕТ</em>
      <i className="spk s1" aria-hidden="true" />
      <i className="spk s2" aria-hidden="true" />
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

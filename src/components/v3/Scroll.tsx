'use client';

import {
  createContext, useContext, useEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';

/**
 * Скрол-двигун The Boat-підходу. Без залежностей:
 * - ScrollRoot читає scrollY через rAF (одна підписка на все)
 * - Chapter = висока секція зі sticky-сценою; дітям віддає progress 0..1
 * - Layer = паралакс-шар (depth у svh)
 * - Beat = біт: показується у вікні прогресу з ефектом входу
 * - useTrigger = одноразовий постріл при перетині порогу (звук, шейк)
 */

const ScrollCtx = createContext({ y: 0, vh: 800 });

export function useScrollState() {
  return useContext(ScrollCtx);
}

export function ScrollRoot({ children }: { children: ReactNode }) {
  const [s, setS] = useState({ y: 0, vh: 800 });
  useEffect(() => {
    let raf = 0;
    const read = () => {
      setS({ y: window.scrollY, vh: window.innerHeight });
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return <ScrollCtx.Provider value={s}>{children}</ScrollCtx.Provider>;
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Прогрес підвідрізка [a..b] загального прогресу. */
export const span = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export function Chapter({
  beats = 2.5,
  className = '',
  children,
}: {
  /** висота глави у в'юпортах: 1 біт ≈ 1 екран скролу */
  beats?: number;
  className?: string;
  children: (p: number) => ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const { y, vh } = useContext(ScrollCtx);
  const [box, setBox] = useState({ top: 0, h: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top + window.scrollY, h: el.offsetHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const p = clamp01((y - box.top) / Math.max(1, box.h - vh));
  return (
    <section ref={ref} className={`v3-chapter ${className}`} style={{ height: `${beats * 100}svh` }}>
      <div className="v3-sticky">{children(p)}</div>
    </section>
  );
}

export function Layer({
  p,
  depth = 0,
  x = 0,
  className = '',
  style,
  children,
}: {
  p: number;
  /** наскільки шар проїде за главу, в svh (плюс = повзе вгору повільніше за скрол) */
  depth?: number;
  /** горизонтальний хід за главу, у vw */
  x?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ty = (0.5 - p) * depth;
  const tx = (p - 0.5) * x;
  return (
    <div
      className={`v3-layer ${className}`}
      style={{ ...style, transform: `translate3d(${tx}vw, ${ty}svh, 0)` }}
    >
      {children}
    </div>
  );
}

export function Beat({
  p,
  at,
  until = 2,
  fx = 'up',
  className = '',
  style,
  children,
}: {
  p: number;
  at: number;
  until?: number;
  fx?: 'up' | 'pop' | 'onoma' | 'fade';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const on = p >= at && p < until;
  return (
    <div className={`v3-beat fx-${fx} ${on ? 'on' : ''} ${className}`} style={style} aria-hidden={!on}>
      {children}
    </div>
  );
}

/** Одноразовий постріл, коли прогрес перетинає поріг знизу вгору. */
export function useTrigger(p: number, at: number, fn: () => void) {
  const prev = useRef(p);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (prev.current < at && p >= at) fnRef.current();
    prev.current = p;
  }, [p, at]);
}

'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/* реальний час навіть при rAF-тротлінгу (фонова вкладка, фризи) —
   решта сцени теж живе на real-time годиннику */
gsap.ticker.lagSmoothing(0);

/**
 * Транзішн «інтро → кадр води»: 5 прийомів на GSAP timeline.
 * Оверлей стартує суцільним кольором інтро (#16110d) — стик безшовний,
 * під ним уже живе BallDive; по завершенні onDone знімає оверлей.
 */
export type TransKind = 'tiles' | 'iris' | 'strips' | 'wave' | 'glitch' | 'wave1' | 'wave2' | 'wave3';

const DARK = '#16110d';

/* піксельно-зубчастий верхній край хвилі (clip-path polygon) */
function jaggedTop(steps: number, maxH: number): string {
  const pts: string[] = ['0% 100%'];
  for (let i = 0; i < steps; i++) {
    const x0 = (i * 100) / steps, x1 = ((i + 1) * 100) / steps;
    const h = ((i * 37) % maxH) + 1;
    pts.push(`${x0.toFixed(1)}% ${h}%`, `${x1.toFixed(1)}% ${h}%`);
  }
  pts.push('100% 100%');
  return `polygon(${pts.join(',')})`;
}

export default function Transition({ kind, onDone }: { kind: TransKind; onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tl = gsap.timeline({ onComplete: () => doneRef.current() });
    const el = (css: string) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;' + css;
      root.append(d);
      return d;
    };

    if (kind === 'tiles') {
      /* П1: екран розсипається на піксель-тайли (stagger from random) */
      const cols = 10, rows = 16;
      const tiles: HTMLElement[] = [];
      for (let i = 0; i < cols * rows; i++) {
        const x = i % cols, y = (i / cols) | 0;
        tiles.push(el(
          `background:${DARK};left:${(x * 100) / cols}%;top:${(y * 100) / rows}%;` +
          `width:${100 / cols + 0.15}%;height:${100 / rows + 0.15}%;`
        ));
      }
      tl.to(tiles, {
        opacity: 0, scale: 0.55, duration: 0.32, ease: 'power2.in',
        stagger: { each: 0.0055, from: 'random' },
      }, 0.1);
    } else if (kind === 'iris') {
      /* П2: іріс — діра в точці лого росте й відкриває небо */
      const cover = el(`inset:0;background:${DARK};`);
      const p = { r: 0.01 };
      tl.to(p, {
        r: 135, duration: 1.15, ease: 'power3.inOut',
        onUpdate: () => {
          const m = `radial-gradient(circle ${p.r}vmax at 50% 44%, transparent ${Math.max(0, p.r - 3)}vmax, #000 ${p.r}vmax)`;
          cover.style.webkitMaskImage = m;
          cover.style.maskImage = m;
        },
      }, 0.05);
    } else if (kind === 'strips') {
      /* П3: вертикальні стрічки відлітають угору від країв до центру */
      const n = 8;
      const strips: HTMLElement[] = [];
      for (let i = 0; i < n; i++) {
        strips.push(el(
          `background:${DARK};top:-2%;height:104%;` +
          `left:${(i * 100) / n}%;width:${100 / n + 0.2}%;`
        ));
      }
      tl.to(strips, {
        yPercent: -108, duration: 0.55, ease: 'power3.in',
        stagger: { each: 0.065, from: 'edges' },
      }, 0.1);
    } else if (kind === 'wave') {
      /* П4: вода заливає екран знизу і відступає вже над небом */
      const base = el(`inset:0;background:${DARK};`);
      const back = el(`left:0;width:100%;top:100%;height:130%;background:#0d3346;clip-path:${jaggedTop(14, 8)};`);
      const front = el(`left:0;width:100%;top:100%;height:130%;background:#123c52;clip-path:${jaggedTop(18, 6)};`);
      tl.to(back, { top: '-12%', duration: 0.55, ease: 'power2.in' }, 0)
        .to(front, { top: '-8%', duration: 0.55, ease: 'power2.in' }, 0.1)
        .set(base, { opacity: 0 })
        .to(front, { top: '102%', duration: 0.75, ease: 'power2.inOut' }, '+=0.08')
        .to(back, { top: '102%', duration: 0.75, ease: 'power2.inOut' }, '<0.09');
    } else if (kind === 'wave1' || kind === 'wave2' || kind === 'wave3') {
      /* W1-W3: покращена хвиля — повільніша, багатошарова, з піною */
      const base = el(`inset:0;background:${DARK};`);
      const child = (parent: HTMLElement, css: string) => {
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;' + css;
        parent.append(d);
        return d;
      };
      /* передній шар — обгортка: тіло + рвана піна на гребені */
      const mkFront = (bodyColor: string) => {
        const wrap = el('left:-2%;width:104%;top:100%;height:132%;');
        child(wrap, `left:0;width:100%;top:3%;height:100%;background:${bodyColor};clip-path:${jaggedTop(18, 6)};`);
        child(wrap, `left:0;width:100%;top:0;height:5.5%;background:#e8f6fb;clip-path:${jaggedTop(24, 70)};`);
        return wrap;
      };
      const mkBack = (color: string, steps: number, maxH: number) =>
        el(`left:-2%;width:104%;top:100%;height:132%;background:${color};clip-path:${jaggedTop(steps, maxH)};`);

      if (kind === 'wave1') {
        /* W1: шторм — 4 шари від світлого до темного + бризки перед фронтом */
        const b1 = mkBack('#2f7292', 11, 9);
        const b2 = mkBack('#1d5674', 14, 8);
        const b3 = mkBack('#164861', 17, 7);
        const front = mkFront('#0d3346');
        const drops = Array.from({ length: 9 }, (_, i) =>
          el(`width:3px;height:3px;background:#eef8ff;left:${4 + i * 11}%;top:58%;opacity:0;`));
        tl.to(b1, { top: '-16%', duration: 1.35, ease: 'power2.inOut' }, 0)
          .to(b2, { top: '-13%', duration: 1.3, ease: 'power2.inOut' }, 0.14)
          .to(b3, { top: '-10%', duration: 1.25, ease: 'power2.inOut' }, 0.28)
          .to(front, { top: '-8%', duration: 1.2, ease: 'power2.inOut' }, 0.42)
          .to(drops, { top: '20%', opacity: 1, duration: 0.45, ease: 'power1.out', stagger: 0.045 }, 0.95)
          .to(drops, { top: '10%', opacity: 0, duration: 0.4, ease: 'power1.in', stagger: 0.045 }, 1.4)
          .set(base, { opacity: 0 }, 1.65)
          .to(front, { top: '104%', duration: 1.15, ease: 'power2.inOut' }, 1.8)
          .to(b3, { top: '104%', duration: 1.15, ease: 'power2.inOut' }, 1.9)
          .to(b2, { top: '104%', duration: 1.1, ease: 'power2.inOut' }, 2.0)
          .to(b1, { top: '104%', duration: 1.05, ease: 'power2.inOut' }, 2.1);
      } else if (kind === 'wave2') {
        /* W2: жива хвиля — у товщі пливуть рибки і здіймаються бульбашки */
        const b1 = mkBack('#2a6a8a', 12, 9);
        const b2 = mkBack('#1a4f6c', 15, 7);
        const front = mkFront('#0f3a52');
        const fishCols = ['#e27a5c', '#eec458', '#76c8a8', '#94a8e8', '#e08cbc'];
        const fish = fishCols.map((c, i) => child(front,
          `left:${8 + i * 19}%;top:${22 + (i % 3) * 21}%;width:15px;height:6px;background:${c};opacity:0.9;` +
          `clip-path:polygon(100% 50%, 55% 0, 0 28%, 0 72%, 55% 100%);` +
          (i % 2 ? 'transform:scaleX(-1);' : '')));
        const bubs = Array.from({ length: 8 }, (_, i) => child(front,
          `left:${10 + i * 11}%;top:${70 + (i % 3) * 8}%;width:2px;height:2px;background:rgba(238,248,255,0.85);border-radius:50%;`));
        fish.forEach((f, i) => tl.to(f, { x: (i % 2 ? -1 : 1) * 26, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.2 + i * 0.1));
        bubs.forEach((b, i) => tl.to(b, { top: '6%', opacity: 0, duration: 1.6, ease: 'sine.in' }, 0.6 + i * 0.14));
        tl.to(b1, { top: '-15%', duration: 1.4, ease: 'power2.inOut' }, 0)
          .to(b2, { top: '-12%', duration: 1.35, ease: 'power2.inOut' }, 0.16)
          .to(front, { top: '-8%', duration: 1.3, ease: 'power2.inOut' }, 0.32)
          .set(base, { opacity: 0 }, 1.65)
          .to(front, { top: '104%', duration: 1.2, ease: 'power2.inOut' }, 1.85)
          .to(b2, { top: '104%', duration: 1.15, ease: 'power2.inOut' }, 1.95)
          .to(b1, { top: '104%', duration: 1.1, ease: 'power2.inOut' }, 2.05);
      } else {
        /* W3: подвійний прибій — короткий замах, відкат, повний прохід */
        const b1 = mkBack('#2a6a8a', 12, 9);
        const b2 = mkBack('#1a4f6c', 16, 7);
        const front = mkFront('#0d3346');
        tl.to(front, { top: '46%', duration: 0.75, ease: 'power2.out' }, 0)      // замах
          .to(front, { top: '82%', duration: 0.6, ease: 'power2.in' }, 0.78)     // відкат
          .to(b1, { top: '-15%', duration: 1.0, ease: 'power2.inOut' }, 1.15)    // повний прохід
          .to(b2, { top: '-12%', duration: 0.95, ease: 'power2.inOut' }, 1.28)
          .to(front, { top: '-8%', duration: 0.9, ease: 'power2.inOut' }, 1.42)
          .set(base, { opacity: 0 }, 2.35)
          .to(front, { top: '104%', duration: 1.1, ease: 'power2.inOut' }, 2.5)
          .to(b2, { top: '104%', duration: 1.05, ease: 'power2.inOut' }, 2.6)
          .to(b1, { top: '104%', duration: 1.0, ease: 'power2.inOut' }, 2.7);
      }
    } else {
      /* П5: глітч-кат — смикання, кольорові смуги, флеш, різкий монтаж */
      const cover = el(`inset:0;background:${DARK};`);
      const colors = ['rgba(255,43,166,0.8)', 'rgba(0,229,255,0.8)', 'rgba(255,255,255,0.9)'];
      const bars = Array.from({ length: 5 }, () => el('left:0;width:100%;height:4%;top:20%;opacity:0;'));
      const flash = el('inset:0;background:#fff;opacity:0;');
      for (let s = 0; s < 6; s++) {
        const at = s * 0.07;
        tl.set(cover, { x: (Math.sin(s * 7.3) * 14) | 0 }, at);
        bars.forEach((b, j) => {
          const on = (s + j) % 2 === 0;
          tl.set(b, {
            opacity: on ? 1 : 0,
            top: `${((s * 29 + j * 41) % 90)}%`,
            height: `${2 + ((s * 13 + j * 7) % 10)}%`,
            x: ((Math.sin(s * 3.1 + j) * 34) | 0),
            background: colors[(s + j) % colors.length],
          }, at);
        });
      }
      tl.set(bars, { opacity: 0 }, 0.42)
        .set(cover, { x: 0 }, 0.42)
        .set(flash, { opacity: 0.9 }, 0.44)
        .set(flash, { opacity: 0 }, 0.5)
        .set(cover, { opacity: 0 }, 0.5)
        .set(flash, { opacity: 0.5 }, 0.55)
        .set(flash, { opacity: 0 }, 0.6)
        .to({}, { duration: 0.05 });
    }

    return () => { tl.kill(); root.replaceChildren(); };
  }, [kind]);

  return (
    <div ref={rootRef} style={{
      position: 'absolute', inset: 0, zIndex: 5,
      overflow: 'hidden', pointerEvents: 'none',
    }} />
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';
import { NickFit, RatingChip, PodiumCrown } from '@/components/table/bits';

export type ShowcaseTop = { p: Player; rating: number };

const CAROUSEL_MS = 3600;
const CLOSE_MS = 180;
const TRAIL_MS = 420;   // життя сліду м'яча
const RALLY_MS = 1500;  // один переліт між ракетками

/** Токени Memphis → кольори canvas (раз на маунт; тема підхоплюється сама). */
function readTokens(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  return {
    ink: v('--line', '#16110D'),
    pink: v('--pink', '#FF2E88'),
    cyan: v('--cyan', '#00CFC1'),
    yellow: v('--yellow', '#FFC619'),
  };
}

function roundedRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * Заставка-вітрина (attract mode): стіл вільний і ніхто не тапав ≥2 хв →
 * повноекранний процедурний ралі на canvas (м'яч дугами між двома ракетками,
 * відскок від «столу», слід), повільна карусель подіуму топ-3 і пульсуюче
 * «ТАПНИ — ГРАЙМО». Будь-який pointerdown знімає миттєво (короткий фейд, щоб
 * той самий тап не провалився в кнопку під заставкою). rAF ставиться на паузу
 * при document.hidden; батько демонтує компонент, щойно з полінгу приходить
 * гра або відкривається будь-який оверлей. reduced-motion: батько взагалі
 * не запускає заставку.
 */
export default function Showcase({ top3, onDismiss }: {
  top3: ShowcaseTop[];
  onDismiss: () => void;
}) {
  const cvsRef = useRef<HTMLCanvasElement>(null);
  const [slide, setSlide] = useState(0);
  const [closing, setClosing] = useState(false);
  const closedRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    setClosing(true);
    closeTimer.current = setTimeout(onDismiss, CLOSE_MS);
  };

  /* --- повільна карусель подіуму --- */
  useEffect(() => {
    if (top3.length < 2) return;
    const t = setInterval(() => {
      if (!document.hidden) setSlide((s) => (s + 1) % top3.length);
    }, CAROUSEL_MS);
    return () => clearInterval(t);
  }, [top3.length]);

  /* --- процедурний ралі: чиста рАФ-петля, пауза на hidden, повний cleanup --- */
  useEffect(() => {
    const cvs = cvsRef.current;
    const ctx = cvs?.getContext('2d');
    if (!cvs || !ctx) return;

    const col = readTokens(cvs);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0; let h = 0;
    const resize = () => {
      w = cvs.clientWidth; h = cvs.clientHeight;
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const trail: { x: number; y: number; t: number }[] = [];

    const geom = () => {
      const px = Math.max(70, Math.min(w * 0.16, 200));
      // портрет: карусель подіуму займає центр — ралі опускаємо в нижню третину,
      // щоб м'яч не літав за карткою; ландшафт — класична середина
      const portrait = h > w * 1.15;
      return {
        xA: px, xB: w - px,
        yPad: h * (portrait ? 0.62 : 0.44),                        // висота «удару»
        yTable: Math.min(h * (portrait ? 0.8 : 0.72), h - 110),    // умовний рівень стола
        ball: Math.max(9, Math.min(15, w * 0.011)),
      };
    };

    // парабола від y0 до y1 з підйомом peak над хордою
    const arcY = (u: number, y0: number, y1: number, peak: number) =>
      y0 + (y1 - y0) * u - peak * 4 * u * (1 - u);

    const ballAt = (t: number) => {
      const g = geom();
      const n = Math.floor(t / RALLY_MS);
      const u = (t % RALLY_MS) / RALLY_MS;
      const ltr = n % 2 === 0;
      const x0 = ltr ? g.xA : g.xB;
      const x1 = ltr ? g.xB : g.xA;
      const x = x0 + (x1 - x0) * u;
      const seed = Math.sin(n * 12.9898) * 0.5 + 0.5;      // стабільний «рандом» розіграшу
      const B = 0.52;                                       // фаза відскоку від стола
      const peak1 = h * (0.15 + 0.08 * seed);
      const peak2 = h * (0.10 + 0.06 * (1 - seed));
      const y = u < B
        ? arcY(u / B, g.yPad, g.yTable, peak1)
        : arcY((u - B) / (1 - B), g.yTable, g.yPad, peak2);
      return { x, y, u, ltr, g };
    };

    const paddle = (x: number, y: number, side: 1 | -1, swing: number, fill: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * (0.42 - swing * 0.8)); // замах → удар
      ctx.lineWidth = 3;
      ctx.strokeStyle = col.ink;
      ctx.fillStyle = col.yellow;               // ручка
      roundedRect(ctx, -8, 24, 16, 36, 8);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = fill;                     // лопать
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 37, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    };

    const draw = (now: number) => {
      const { x, y, u, ltr, g } = ballAt(now);
      ctx.clearRect(0, 0, w, h);

      // пунктир «стола» + сітка по центру
      ctx.strokeStyle = col.ink;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.22;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(g.xA - 44, g.yTable + g.ball + 8);
      ctx.lineTo(g.xB + 44, g.yTable + g.ball + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(w / 2, g.yTable + g.ball + 8);
      ctx.lineTo(w / 2, g.yTable - 26);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // слід м'яча (короткий, тане)
      trail.push({ x, y, t: now });
      while (trail.length > 0 && now - trail[0].t > TRAIL_MS) trail.shift();
      for (const p of trail) {
        const a = 1 - (now - p.t) / TRAIL_MS;
        ctx.globalAlpha = a * 0.32;
        ctx.fillStyle = col.yellow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, g.ball * (0.35 + 0.5 * a), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ракетки: та, що б'є, «доводить» удар; та, що чекає, робить замах
      const swingA = ltr ? Math.max(0, 1 - u * 4) : Math.max(0, (u - 0.75) * 4);
      const swingB = ltr ? Math.max(0, (u - 0.75) * 4) : Math.max(0, 1 - u * 4);
      paddle(g.xA - 36, g.yPad + 6, -1, swingA, col.pink);
      paddle(g.xB + 36, g.yPad + 6, 1, swingB, col.cyan);

      // м'яч
      ctx.fillStyle = col.yellow;
      ctx.strokeStyle = col.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, g.ball, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    let raf = 0;
    let running = false;
    const step = (now: number) => { draw(now); raf = requestAnimationFrame(step); };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(step); } };
    const stop = () => { if (running) { running = false; cancelAnimationFrame(raf); } };
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={'k-show' + (closing ? ' out' : '')} role="dialog" aria-modal="true"
      aria-label="Стіл вільний — тапни, щоб грати" onPointerDown={close}>
      <canvas ref={cvsRef} className="k-show-canvas" aria-hidden="true" />
      <span className="k-deco ring" style={{ width: 150, height: 150, top: -54, left: '8%', background: 'var(--yellow)', opacity: .5 }} />
      <span className="k-deco dotgrid" style={{ width: 200, height: 130, bottom: 10, right: -26, transform: 'rotate(8deg)' }} />

      <div className="k-show-ui">
        <span className="k-show-kicker">СТІЛ ВІЛЬНИЙ · ТОП КЛУБУ</span>

        {top3.length > 0 ? (
          <div className="k-show-pod" aria-label="Подіум клубу">
            {top3.map((t, i) => (
              <div key={t.p.id} className={'k-show-card' + (i === slide ? ' on' : '')}>
                {i === 0 && <PodiumCrown className="k-show-crown" />}
                <span className={'k-show-place p' + (i + 1)}>{i + 1}</span>
                <HeroArt src={t.p.hero?.art} alt={t.p.nickname} color={t.p.hero?.color || 'var(--yellow)'}
                  initial={(t.p.nickname || t.p.name || '?').charAt(0).toUpperCase()} size={128} radius={22} />
                <span className="k-show-nick"><NickFit nick={t.p.nickname || t.p.name} oneLine /></span>
                <RatingChip rating={t.rating} />
              </div>
            ))}
            <div className="k-show-dots" aria-hidden="true">
              {top3.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}
            </div>
          </div>
        ) : <span />}

        <span className="k-show-cta">ТАПНИ — ГРАЙМО</span>
      </div>
    </div>
  );
}

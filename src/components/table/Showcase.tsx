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

    /* --- зграя міні-м'ячиків: блукає → шикується у кубок → розліт (цикл) ---
       Патерн towers (SwarmLogo): цілі беруться з офскрін-растеризації силуета,
       кожен м'ячик — пружина до своєї цілі. */
    const SWARM_N = 110;
    type Boid = { x: number; y: number; vx: number; vy: number };
    const swarm: Boid[] = [];
    let targets: { x: number; y: number }[] = [];
    let lastPhase = '';
    let lastNow = 0;

    const trophyPoints = (() => {
      const T = 200;
      const oc = document.createElement('canvas');
      oc.width = T; oc.height = T;
      const c = oc.getContext('2d');
      if (!c) return [] as { x: number; y: number }[];
      // КОНТУР, не заливка: розсип крапок по лініях читається як гліф,
      // а по заливці — як безформна хмара
      c.strokeStyle = '#000'; c.lineWidth = 9;
      c.beginPath(); // чаша
      c.moveTo(56, 34); c.lineTo(144, 34);
      c.bezierCurveTo(144, 92, 126, 116, 100, 116);
      c.bezierCurveTo(74, 116, 56, 92, 56, 34);
      c.closePath(); c.stroke();
      c.beginPath(); c.arc(46, 60, 22, -Math.PI * .5, Math.PI * .62); c.stroke();  // ручки
      c.beginPath(); c.arc(154, 60, 22, Math.PI * .38, Math.PI * 1.5); c.stroke();
      c.strokeRect(93, 118, 14, 20);  // ніжка
      c.strokeRect(74, 141, 52, 8);   // плита
      c.strokeRect(62, 152, 76, 12);  // база
      const pts: { x: number; y: number }[] = [];
      const img = c.getImageData(0, 0, T, T).data;
      for (let y = 0; y < T; y += 4) {
        for (let x = 0; x < T; x += 4) {
          if (img[(y * T + x) * 4 + 3] > 120) pts.push({ x: x / T, y: y / T });
        }
      }
      return pts;
    })();

    const assignTargets = () => {
      // кубок — у вільній зоні: ландшафт — зліва від подіуму, портрет — над ним
      const portrait = h > w * 1.15;
      const size = Math.min(w, h) * (portrait ? .38 : .42);
      const cx = (portrait ? w * .5 : w * .22) - size / 2;
      const cy = h * (portrait ? .04 : .12);
      const step = Math.max(1, Math.floor(trophyPoints.length / SWARM_N));
      targets = [];
      for (let i = 0; i < SWARM_N; i++) {
        const p = trophyPoints[(i * step) % Math.max(1, trophyPoints.length)];
        if (p) targets.push({ x: cx + p.x * size, y: cy + p.y * size });
      }
    };

    // фази циклу зграї, мс: блукання → кубок → розліт
    const CYCLE = 15000, FORM_AT = 7500, BURST_AT = 12800;
    const stepSwarm = (now: number, dt: number) => {
      if (swarm.length === 0 && w > 0) {
        for (let i = 0; i < SWARM_N; i++) swarm.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120,
        });
      }
      const tc = now % CYCLE;
      const phase = tc < FORM_AT ? 'wander' : tc < BURST_AT ? 'form' : 'burst';
      if (phase !== lastPhase) {
        if (phase === 'form') assignTargets();
        if (phase === 'burst') for (const b of swarm) {
          const a = Math.random() * Math.PI * 2, sp = 240 + Math.random() * 340;
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
        }
        lastPhase = phase;
      }
      const k = dt / 1000;
      swarm.forEach((b, i) => {
        if (phase === 'form' && targets[i % targets.length]) {
          // пряме позиційне зближення: гліф збирається чітко, без пружинного дрейфу
          const t = targets[i % targets.length];
          const e = Math.min(1, dt * .005);
          b.x += (t.x - b.x) * e;
          b.y += (t.y - b.y) * e + Math.sin(now * .003 + i * .7) * .25; // «дихання»
          b.vx = 0; b.vy = 0;
          return;
        } else {
          // дрейф до мандрівного атрактора + шум; на розльоті — лише інерція
          if (phase === 'wander') {
            const ax = w / 2 + Math.sin(now * .00023 + i * .07) * w * .34;
            const ay = h / 2 + Math.cos(now * .00031 + i * .05) * h * .3;
            b.vx += ((ax - b.x) * .35 + (Math.random() - .5) * 380) * k;
            b.vy += ((ay - b.y) * .35 + (Math.random() - .5) * 380) * k;
          }
          const damp = Math.exp(-dt / 1400);
          b.vx *= damp; b.vy *= damp;
        }
        b.x += b.vx * k; b.y += b.vy * k;
        if (b.x < -20) b.x += w + 40; else if (b.x > w + 20) b.x -= w + 40;
        if (b.y < -20) b.y += h + 40; else if (b.y > h + 20) b.y -= h + 40;
      });
      return phase;
    };

    const drawSwarm = (phase: string) => {
      const r = Math.max(4, Math.min(6.5, w * .005));
      ctx.lineWidth = 1.8;
      swarm.forEach((b, i) => {
        ctx.globalAlpha = phase === 'form' ? .95 : .7;
        ctx.fillStyle = i % 9 === 0 ? col.pink : i % 9 === 5 ? col.cyan : col.yellow;
        ctx.strokeStyle = col.ink;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };

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
      const dt = Math.min(50, lastNow ? now - lastNow : 16);
      lastNow = now;
      ctx.clearRect(0, 0, w, h);

      // зграя — фоновий шар під ралі
      drawSwarm(stepSwarm(now, dt));

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

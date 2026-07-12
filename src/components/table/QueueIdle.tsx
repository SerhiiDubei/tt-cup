'use client';
import { useEffect, useRef } from 'react';
import {
  readPalette, mulberry32,
  drawBall, drawShadow, drawPaddle, drawRipple, drawConfettiPiece,
  drawTable, drawGhost,
} from '@/lib/anim/sprites';
import {
  type Shot, type RallyTuning,
  between, makeShot, makeSmashCadence, shotX, shotY, shotZ,
  makeFx, pushTrail, spawnConfetti, stepFx,
} from '@/lib/anim/rally';

/* «Стіл грає сам»: примарне ралі у порожній черзі. Вид згори — стіл-спрайт,
   привиди тримають ракетки; висота польоту фейкова (зсув по y + окрема тінь).
   Підхід remotion-towers: один canvas, процедурні спрайти, seeded-симуляція;
   rAF сам спить, коли вкладку сховано. Математика ралі — @/lib/anim/rally. */

/* ---------- хореографія (крутилки під смак) ---------- */
const TUNING: RallyTuning = {
  shotMs: [860, 1300],   // політ звичайного удару
  smashMs: [400, 540],   // політ смешу
  smashEvery: [5, 9],    // смеш раз на стільки ударів
  arc: [.30, .48],       // висота дуги, частка висоти столу
  spin: .38,             // бокове кручення (кривина шляху)
};
const BALL_R = 12;
const CONTACT_Z = 16;    // висота м'яча в момент удару (× S)
const SWING_MS = 170;    // тривалість замаху-кіку ракетки
const GHOST_ZONE = 34;   // смуга для привидів зверху/знизу (× S)

export default function QueueIdle() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current, cv = cvRef.current;
    const ctx = cv?.getContext('2d');
    if (!wrap || !cv || !ctx) return;

    const pal = readPalette(cv);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rnd = mulberry32(0x77CB01);
    const isSmashTime = makeSmashCadence(rnd, TUNING.smashEvery);
    const confColors = [pal.pink, pal.cyan, pal.yellow, pal.purple, pal.lime];

    let W = 0, H = 0, S = 1; // S — масштаб спрайтів від габаритів панелі

    /* ---------- стан симуляції ---------- */
    // pads[0] — низ (рожева), pads[1] — верх (синя)
    const pads = [
      { x: 0, y: 0, swing: 9e3, side: 1 },
      { x: 0, y: 0, swing: 9e3, side: -1 },
    ];
    const ghosts = [{ x: 0 }, { x: 0 }]; // примарні гравці — лаг-послідовники ракеток
    let shot: Shot | null = null;
    let t = 0;                 // прогрес поточного удару, мс
    let toSide = 1;            // хто приймає
    let bounced = false;
    let squash = 0, shake = 0, rot = 0, time = 0;
    const fx = makeFx();

    const padY = (side: number) => (side === 1 ? H - GHOST_ZONE * S - 4 : GHOST_ZONE * S + 4);

    // стіл справжніх пропорцій: грають УЗДОВЖ довгої сторони (152.5/274 ≈ .56),
    // інакше на широкій панелі виходить «гра в поперек»
    const tableGeom = () => {
      const gz = GHOST_ZONE * S;
      const len = H - gz * 2;
      const tw = Math.min(W - 20, len * 0.6);
      return { gz, len, tw, tx: (W - tw) / 2 };
    };

    const newShot = (fromIdx: number) => {
      const from = pads[fromIdx], to = pads[1 - fromIdx];
      const g = tableGeom();
      const margin = Math.max(24, g.tw * .16); // приземлення не впритул до кромки
      shot = makeShot({
        rnd, tuning: TUNING,
        from: { x: from.x, y: from.y },
        to: { x: g.tx + margin + rnd() * Math.max(1, g.tw - margin * 2), y: padY(to.side) },
        len: H, smash: isSmashTime(), bounce: true,
      });
      t = 0; bounced = false; toSide = 1 - fromIdx;
      from.swing = 0;
    };

    /* ---------- рендер одного кадру ---------- */
    const render = (ball: { x: number; y: number; z: number } | null) => {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (shake > .3) ctx.translate((rnd() - .5) * shake, (rnd() - .5) * shake);

      // стіл-спрайт правильних пропорцій по центру, між смугами привидів
      const g = tableGeom();
      const gz = g.gz;
      drawTable(ctx, g.tx, g.gz, g.tw, g.len, pal.cyan, pal.ink, S);

      for (const r of fx.ripples) drawRipple(ctx, r.x, r.y, r.t, pal.ink, S);

      for (const p of fx.trail) { // спін-трейл (комета за м'ячем)
        ctx.globalAlpha = p.a * .45; ctx.fillStyle = pal.yellow;
        ctx.beginPath(); ctx.arc(p.x, p.y, (BALL_R * .85 * p.a + 2) * S, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (ball && shot) { // тінь на столі під м'ячем
        const k = Math.max(0, 1 - ball.z / (H * .5));
        drawShadow(ctx, ball.x, ball.y, BALL_R * S * (0.5 + k * .6), .12 + k * .14, pal.ink);
      }

      // кут ракетки = ручка назовні + нахил до м'яча + антиципація/кік
      const u = shot ? t / shot.dur : 0;
      const padAngle = (i: number) => {
        const p = pads[i];
        let ang = p.side === 1 ? 0 : Math.PI;
        if (ball) ang += Math.max(-.4, Math.min(.4, (ball.x - p.x) * .0022)) * p.side;
        if (i === toSide && u > .68) ang += p.side * ((u - .68) / .32) * .5; // замах назад
        if (p.swing < SWING_MS) ang -= p.side * (1 - p.swing / SWING_MS) * .85; // кік уперед
        return ang;
      };
      // нахил привида: погойдування + тягнеться за замахом, кік корпусом при ударі
      const ghostLean = (i: number) => {
        const p = pads[i];
        let lean = Math.sin(time * .0009 + i * 2.4) * .07;
        if (i === toSide && u > .68) lean += p.side * ((u - .68) / .32) * .18;
        if (p.swing < SWING_MS) lean -= p.side * (1 - p.swing / SWING_MS) * .3;
        return lean;
      };
      const eyeDx = (gx: number) => (ball ? (ball.x - gx) * .02 : 0);

      // верхній привид і ракетка — за м'ячем (псевдоглибина)
      drawGhost(ctx, ghosts[1].x, gz * .55, ghostLean(1), .95 * S, pal.ink, eyeDx(ghosts[1].x), .8);
      drawPaddle(ctx, pads[1].x, pads[1].y, padAngle(1), S, pal.blue, pal.ink);

      if (ball && shot) {
        if (shot.smash && u > .08 && u < shot.bT) { // спідлайни смешу
          const s = shot, u2 = Math.max(0, u - .06);
          const cz = CONTACT_Z * S;
          const dx = ball.x - shotX(s, u2);
          const dy = (shotY(s, u) - shotZ(s, u, cz)) - (shotY(s, u2) - shotZ(s, u2, cz));
          const L = Math.hypot(dx, dy) || 1;
          ctx.strokeStyle = pal.ink; ctx.globalAlpha = .3; ctx.lineWidth = 2.5 * S;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(ball.x - (dx / L) * 16 * S + k * 7 * S * (dy / L), ball.y - ball.z - (dy / L) * 16 * S - k * 7 * S * (dx / L));
            ctx.lineTo(ball.x - (dx / L) * 34 * S + k * 7 * S * (dy / L), ball.y - ball.z - (dy / L) * 34 * S - k * 7 * S * (dx / L));
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        drawBall(ctx, ball.x, ball.y - ball.z, BALL_R * S, rot, pal.ink, squash);
      }

      // нижній привид за своєю ракеткою, ракетка — поверх м'яча
      drawGhost(ctx, ghosts[0].x, H - gz * .55, ghostLean(0), .95 * S, pal.ink, eyeDx(ghosts[0].x), .8);
      drawPaddle(ctx, pads[0].x, pads[0].y, padAngle(0), S, pal.pink, pal.ink);

      for (const c of fx.confetti) drawConfettiPiece(ctx, c.x, c.y, c.rot, 6 * S, c.c, c.shape, Math.max(0, c.life));
      ctx.restore();
    };

    /* ---------- статичний кадр для prefers-reduced-motion ---------- */
    const drawStatic = () => {
      pads[0].x = W / 2; pads[0].y = padY(1);
      pads[1].x = W / 2; pads[1].y = padY(-1);
      ghosts[0].x = W / 2 - 26 * S; ghosts[1].x = W / 2 + 26 * S;
      shot = null;
      render(null);
      drawShadow(ctx, W / 2, H / 2 + 26 * S, BALL_R * S * .9, .18, pal.ink);
      drawBall(ctx, W / 2, H / 2 + 8, BALL_R * S, .6, pal.ink);
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth; H = wrap.clientHeight;
      S = Math.max(1, Math.min(2, Math.min(W, H * .8) / 230));
      cv.width = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) drawStatic();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    if (reduced) return () => ro.disconnect(); // без руху — один кадр

    /* ---------- головний цикл ---------- */
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(50, now - last); last = now;
      time += dt;
      if (W < 60 || H < 90) return; // ще не зміряно / замалі габарити

      if (!shot) { // перший удар — з центру низу
        pads[0].x = W / 2; pads[1].x = W / 2;
        pads[0].y = padY(1); pads[1].y = padY(-1);
        ghosts[0].x = W / 2; ghosts[1].x = W / 2;
        newShot(0);
      }
      const s = shot as Shot;
      t += dt;

      // ракетки: приймаючий їде до точки прийому, інший погойдується
      pads.forEach((p, i) => {
        const target = i === toSide ? s.x1 : W / 2 + Math.sin(time * .0007 + i * 2.1) * tableGeom().tw * .3;
        p.x += (target - p.x) * Math.min(1, dt * .006);
        p.y = padY(p.side) + Math.sin(time * .0011 + i * 1.7) * 2.5;
        p.swing += dt;
        // привид ліниво доганяє, тримаючись збоку від ракетки (низ — зліва, верх — справа)
        const gTarget = p.x + (i === 0 ? -26 : 26) * S;
        ghosts[i].x += (gTarget - ghosts[i].x) * Math.min(1, dt * .0035);
      });

      const u = Math.min(1, t / s.dur);
      if (!bounced && u >= s.bT) { // відскік на столі
        bounced = true; squash = 1;
        fx.ripples.push({ x: shotX(s, s.bT), y: shotY(s, s.bT), t: 0 });
      }
      squash = Math.max(0, squash - dt / 140);
      rot += (s.smash ? .022 : .011) * dt;
      shake *= Math.exp(-dt / 90);

      const ball = { x: shotX(s, u), y: shotY(s, u), z: shotZ(s, u, CONTACT_Z * S) };
      pushTrail(fx, ball.x, ball.y - ball.z);
      stepFx(fx, dt);

      if (t >= s.dur) { // прийом: удар у відповідь
        const rec = pads[toSide];
        rec.swing = 0; squash = .7;
        if (s.smash) { spawnConfetti(fx, rnd, s.x1, rec.y, confColors, S); shake = 7; }
        newShot(toSide);
      }

      render(ball);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div ref={wrapRef} className="k-idle-rally" aria-hidden="true">
      <canvas ref={cvRef} />
    </div>
  );
}

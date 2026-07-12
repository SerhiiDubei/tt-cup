'use client';
import { useEffect, useRef } from 'react';
import { readPalette, mulberry32, drawBall, drawConfettiPiece } from '@/lib/anim/sprites';
import {
  type Shot, type RallyTuning,
  makeShot, makeSmashCadence, shotX, shotY, shotZ,
  makeFx, pushTrail, spawnConfetti, stepFx,
} from '@/lib/anim/rally';

/* Живе ралі поверх VS-карток, поки гра триває: м'яч літає від картки до
   картки чистою дугою (без відскоку — стола тут «нема»). Canvas лежить над
   .k-versus і не ловить тапи; події ударів пробиваються у DOM WAAPI-панчами:
   поп VS-бейджа і нахил картки, що приймає (анімації самозавершні, як FLIP у
   QueuePanel). Смеш = конфеті + сильніший панч. reduced-motion → нічого. */

const TUNING: RallyTuning = {
  shotMs: [950, 1500],
  smashMs: [430, 560],
  smashEvery: [4, 7],
  arc: [.32, .52], // × len (H*.55) → пік дуги трохи вище VS-бейджа
  spin: .22,
};
const BALL_R = 13;
const CONTACT_Z = 8;
const EASE = 'cubic-bezier(.22,1,.36,1)';

export default function LiveRally() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current, cv = cvRef.current;
    const ctx = cv?.getContext('2d');
    if (!wrap || !cv || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const pal = readPalette(cv);
    const rnd = mulberry32(0x115E11);
    const isSmashTime = makeSmashCadence(rnd, TUNING.smashEvery);
    const confColors = [pal.pink, pal.cyan, pal.yellow, pal.purple, pal.lime];

    // DOM-цілі для панчів: бейдж VS і картки гравців (живуть поруч у .k-versus)
    const versus = wrap.parentElement;
    const burst = versus?.querySelector<HTMLElement>('.k-vs-burst') ?? null;
    const cards = versus ? Array.from(versus.querySelectorAll<HTMLElement>('.k-side')) : [];

    let W = 0, H = 0, S = 1;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth; H = wrap.clientHeight;
      S = Math.max(.9, Math.min(1.6, H / 300));
      cv.width = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    /* ---------- стан ---------- */
    let shot: Shot | null = null;
    let t = 0, toSide = 1; // side 0 — ліва картка, 1 — права
    let squash = 0, rot = 0, shake = 0;
    const fx = makeFx();

    // точка удару біля картки: центр арту + випадковий розкид
    const endPoint = (side: number) => ({
      x: W * (side === 0 ? .19 : .81) + (rnd() - .5) * W * .05,
      y: H * .52 + (rnd() - .5) * H * .18,
    });

    const punch = (side: number, smash: boolean) => {
      // база .k-vs-burst — rotate(-8deg): панч мусить її зберігати
      burst?.animate([
        { transform: 'rotate(-8deg) scale(1)' },
        { transform: `rotate(${smash ? -15 : -11}deg) scale(${smash ? 1.16 : 1.07})`, offset: .35 },
        { transform: 'rotate(-8deg) scale(1)' },
      ], { duration: smash ? 430 : 280, easing: EASE });
      cards[side]?.animate([
        { transform: 'none' },
        { transform: `rotate(${side === 0 ? -1.4 : 1.4}deg) translateY(${smash ? 5 : 3}px)`, offset: .35 },
        { transform: 'none' },
      ], { duration: smash ? 420 : 320, easing: EASE });
    };

    const newShot = (fromSide: number) => {
      shot = makeShot({
        rnd, tuning: TUNING,
        from: shot ? { x: shot.x1, y: shot.y1 } : endPoint(fromSide),
        to: endPoint(1 - fromSide),
        len: H * .55, smash: isSmashTime(), bounce: false,
      });
      t = 0; toSide = 1 - fromSide;
    };

    /* ---------- цикл ---------- */
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(50, now - last); last = now;
      if (W < 120 || H < 100) return;
      if (!shot) newShot(0); // перша подача — від лівої картки

      const s = shot as Shot;
      t += dt;
      const u = Math.min(1, t / s.dur);
      squash = Math.max(0, squash - dt / 140);
      rot += (s.smash ? .02 : .01) * dt;
      shake *= Math.exp(-dt / 90);

      const ball = { x: shotX(s, u), y: shotY(s, u), z: shotZ(s, u, CONTACT_Z * S) };
      pushTrail(fx, ball.x, ball.y - ball.z);
      stepFx(fx, dt);

      if (t >= s.dur) { // прийом
        squash = .8;
        punch(toSide, s.smash);
        if (s.smash) { spawnConfetti(fx, rnd, s.x1, s.y1 - CONTACT_Z * S, confColors, S); shake = 6; }
        newShot(toSide);
      }

      /* ---------- рендер ---------- */
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (shake > .3) ctx.translate((rnd() - .5) * shake, (rnd() - .5) * shake);

      for (const p of fx.trail) {
        ctx.globalAlpha = p.a * .4; ctx.fillStyle = pal.yellow;
        ctx.beginPath(); ctx.arc(p.x, p.y, (BALL_R * .8 * p.a + 2) * S, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (s.smash && u > .1 && u < .9) { // спідлайни смешу
        const u2 = Math.max(0, u - .07);
        const cz = CONTACT_Z * S;
        const dx = ball.x - shotX(s, u2);
        const dy = (shotY(s, u) - shotZ(s, u, cz)) - (shotY(s, u2) - shotZ(s, u2, cz));
        const L = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = pal.ink; ctx.globalAlpha = .28; ctx.lineWidth = 2.5 * S;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.moveTo(ball.x - (dx / L) * 15 * S + k * 6 * S * (dy / L), ball.y - ball.z - (dy / L) * 15 * S - k * 6 * S * (dx / L));
          ctx.lineTo(ball.x - (dx / L) * 32 * S + k * 6 * S * (dy / L), ball.y - ball.z - (dy / L) * 32 * S - k * 6 * S * (dx / L));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      drawBall(ctx, ball.x, ball.y - ball.z, BALL_R * S, rot, pal.ink, squash);
      for (const c of fx.confetti) drawConfettiPiece(ctx, c.x, c.y, c.rot, 6 * S, c.c, c.shape, Math.max(0, c.life));
      ctx.restore();
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div ref={wrapRef} className="k-live-rally" aria-hidden="true">
      <canvas ref={cvRef} />
    </div>
  );
}

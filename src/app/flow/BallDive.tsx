'use client';

import { useEffect, useRef } from 'react';

/**
 * КАДР 2 · «Мʼяч падає у воду» — процедурна генерація (обраний підхід).
 * Драматургія: [0-1.6с] просто вода, тиша → [сплеск] мʼяч влітає крізь
 * поверхню → [тоне] меншає з глибиною і віддаляється, вода темніша,
 * слід бульбашок. Камера статична. Low-res canvas → pixelated.
 */
export default function BallDive() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 160, H = 285;
    cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d');
    if (!c2) return;
    const ctx: CanvasRenderingContext2D = c2;

    type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; splash?: boolean };
    let parts: P[] = [];
    let t = 0;
    let raf = 0;
    const SURF = 20;           // рівень поверхні
    const T_DROP = 1.6;        // до цього — просто вода
    const T_HIT = T_DROP + 0.18;

    function frame() {
      t += 1 / 60;

      /* вода: дизер-градієнт, темніша донизу */
      for (let y = 0; y < H; y += 2) {
        const k = y / H;
        ctx.fillStyle = `rgb(${Math.round(16 + 26 * (1 - k))},${Math.round(88 + 62 * (1 - k))},${Math.round(120 + 68 * (1 - k))})`;
        ctx.fillRect(0, y, W, 2);
        if ((y / 2) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          for (let x = (y / 2) % 4; x < W; x += 4) ctx.fillRect(x, y, 1, 1);
        }
      }

      /* поверхня: тонка світла лінія з легкими хвильками; пульс при ударі */
      const hitPulse = t > T_DROP && t < T_DROP + 0.9 ? (1 - (t - T_DROP) / 0.9) : 0;
      ctx.fillStyle = `rgba(215,242,255,${0.55 + hitPulse * 0.4})`;
      for (let x = 0; x < W; x += 2) {
        const wob = Math.sin(t * 2.2 + x * 0.25) * 1.2 + (hitPulse ? Math.sin(x * 0.9 + t * 18) * hitPulse * 2.2 : 0);
        ctx.fillRect(x, Math.round(SURF + wob), 2, 1);
      }
      /* кільце розширюється від точки входу */
      if (hitPulse > 0) {
        const rr = (1 - hitPulse) * 34 + 6;
        ctx.fillStyle = `rgba(230,250,255,${hitPulse * 0.8})`;
        ctx.fillRect(Math.round(W / 2 - rr), SURF - 1, 3, 1);
        ctx.fillRect(Math.round(W / 2 + rr), SURF - 1, 3, 1);
      }

      /* мʼяч: чекає → падає → пробиває → тоне вглиб (меншає) */
      let ballX = W / 2, ballY = -20, ballR = 4.5, show = false;
      if (t >= T_DROP && t < T_HIT) {
        show = true;
        const p = (t - T_DROP) / (T_HIT - T_DROP);
        ballY = -10 + p * (SURF + 10);
      } else if (t >= T_HIT) {
        show = true;
        const d = t - T_HIT;                     // час під водою
        const depth = 1 - Math.exp(-d / 5.2);    // асимптотичне занурення
        ballY = SURF + depth * (H * 0.66);
        ballX = W / 2 + Math.sin(d * 1.15) * (6 * (1 - depth * 0.7));
        ballR = 4.5 - depth * 3.1;               // далі = менший (глибина)
      }

      /* сплеск при ударі */
      if (t >= T_DROP && t < T_DROP + 0.08 && parts.filter((p) => p.splash).length === 0) {
        for (let i = 0; i < 14; i++) {
          parts.push({ x: W / 2, y: SURF, vx: (Math.random() - 0.5) * 2.4, vy: -(1 + Math.random() * 2.2), r: Math.random() < 0.4 ? 2 : 1, life: 1, splash: true });
        }
        for (let i = 0; i < 10; i++) {
          parts.push({ x: W / 2 + (Math.random() - 0.5) * 8, y: SURF + 4, vx: (Math.random() - 0.5) * 0.5, vy: 0.6 + Math.random() * 1.2, r: 1, life: 1 });
        }
      }
      /* слід бульбашок від мʼяча (рідший і дрібніший з глибиною) */
      if (show && t > T_HIT && Math.random() < Math.max(0.12, 0.5 - (t - T_HIT) * 0.05)) {
        parts.push({ x: ballX + (Math.random() - 0.5) * 4, y: ballY - ballR, vx: (Math.random() - 0.5) * 0.25, vy: -(0.35 + Math.random() * 0.5), r: 1, life: 1 });
      }

      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        if (p.splash) { p.vy += 0.09; if (p.y > SURF + 1 && p.vy > 0) p.life = 0; } // бризки падають назад
        p.x += p.vx; p.y += p.vy; p.life -= p.splash ? 0.02 : 0.007;
        ctx.fillStyle = `rgba(228,249,255,${0.8 * p.life})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.r, p.r);
      }

      /* мʼяч: тьмяніє з глибиною (зливається з водою — глибина відчувається) */
      if (show && ballR > 0.8) {
        const deepFade = Math.max(0, 1 - Math.max(0, t - T_HIT) / 16);
        ctx.globalAlpha = 0.35 + deepFade * 0.65;
        ctx.fillStyle = '#f2fafd';
        ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2); ctx.fill();
        if (ballR > 2) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(ballX - ballR * 0.4), Math.round(ballY - ballR * 0.55), 2, 1);
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      imageRendering: 'pixelated', display: 'block',
    }} />
  );
}

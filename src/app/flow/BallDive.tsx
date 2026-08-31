'use client';

import { useEffect, useRef } from 'react';

/**
 * Процедурна анімація «мʼяч тоне» (реф: людина під водою) — canvas на низькій
 * роздільності (справжній піксель-лук через image-rendering: pixelated).
 * mode 'locked' (P1): камера статична, воронка бульбашок зверху, мʼяч тоне.
 * mode 'follow' (P2): камера пливе за мʼячем, вода темнішає з глибиною.
 */
export default function BallDive({ mode }: { mode: 'locked' | 'follow' }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 160, H = 285;
    cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d');
    if (!c2) return;
    const ctx: CanvasRenderingContext2D = c2;

    type Bub = { x: number; y: number; r: number; vy: number; vx: number; life: number };
    let bubs: Bub[] = [];
    let t = 0;
    let raf = 0;

    /* дизер-патерн 2x2 для градієнта */
    function dither(y: number, depth: number) {
      const base = mode === 'follow' ? 0.25 + depth * 0.5 : 0.3;
      const k = Math.min(1, y / H + base - 0.3);
      return k;
    }

    function frame() {
      t += 1 / 60;
      const depth = mode === 'follow' ? Math.min(1, t / 14) : 0;
      /* мʼяч: locked — тоне по екрану; follow — висить у верхній третині, світ пливе */
      const ballY = mode === 'locked'
        ? 40 + Math.min(H - 90, t * 14)
        : 74 + Math.sin(t * 1.1) * 3;
      const ballX = W / 2 + Math.sin(t * 1.4) * (mode === 'locked' ? 5 : 3);

      /* фон з дизерингом */
      for (let y = 0; y < H; y += 2) {
        const k = dither(y, depth);
        const r = Math.round(18 + 30 * (1 - k) - depth * 10);
        const g = Math.round(95 + 55 * (1 - k) - depth * 30);
        const b = Math.round(130 + 60 * (1 - k) - depth * 25);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, y, W, 2);
        if ((y / 2) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.025)';
          for (let x = (y / 2) % 4; x < W; x += 4) ctx.fillRect(x, y, 1, 1);
        }
      }

      /* поверхня-кільце зверху (locked) або сяйво (follow) */
      if (mode === 'locked') {
        ctx.fillStyle = 'rgba(210,240,255,0.9)';
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2;
          const rx = 34 + Math.sin(t * 2 + i) * 2;
          ctx.fillRect(Math.round(W / 2 + Math.cos(a) * rx), Math.round(16 + Math.sin(a) * 6), 2, 1);
        }
      } else {
        const glow = Math.max(0, 1 - depth * 1.2);
        ctx.fillStyle = `rgba(220,245,255,${0.5 * glow})`;
        ctx.fillRect(0, 0, W, 3);
        ctx.fillStyle = `rgba(220,245,255,${0.2 * glow})`;
        ctx.fillRect(0, 3, W, 4);
        /* god rays */
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = `rgba(200,240,255,${0.05 * glow})`;
          const x0 = 20 + i * 45 + Math.sin(t * 0.6 + i) * 6;
          for (let y = 0; y < H * 0.7; y += 2) ctx.fillRect(Math.round(x0 + y * 0.18), y, 5, 2);
        }
      }

      /* спавн бульбашок: воронка зверху (locked) / слід мʼяча (обидва) */
      if (mode === 'locked' && t < 6 && Math.random() < 0.8) {
        bubs.push({ x: W / 2 + (Math.random() - 0.5) * 20, y: 22 + Math.random() * 8, r: Math.random() < 0.3 ? 2 : 1, vy: 0.5 + Math.random(), vx: (Math.random() - 0.5) * 0.4, life: 1 });
      }
      if (Math.random() < 0.5) {
        bubs.push({ x: ballX + (Math.random() - 0.5) * 6, y: ballY - 4, r: 1, vy: -(0.4 + Math.random() * 0.7), vx: (Math.random() - 0.5) * 0.3, life: 1 });
      }
      /* бульбашки */
      bubs = bubs.filter((b) => b.life > 0);
      for (const b of bubs) {
        b.x += b.vx; b.y += b.vy > 0 ? b.vy * 0.6 : b.vy; b.life -= 0.008;
        if (mode === 'follow') b.y += 0.35; /* світ пливе вгору повз камеру */
        ctx.fillStyle = `rgba(225,248,255,${0.75 * b.life})`;
        ctx.fillRect(Math.round(b.x), Math.round(b.y), b.r, b.r);
      }

      /* мʼяч */
      ctx.fillStyle = '#f6fbff';
      ctx.beginPath(); ctx.arc(ballX, ballY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(20,60,90,0.35)';
      ctx.fillRect(Math.round(ballX) - 2, Math.round(ballY) + 2, 4, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(ballX) - 2, Math.round(ballY) - 3, 2, 1);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  return (
    <canvas ref={ref} style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      imageRendering: 'pixelated', display: 'block',
    }} />
  );
}

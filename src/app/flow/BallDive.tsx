'use client';

import { useEffect, useRef } from 'react';

/**
 * КАДР 2 · «Мʼяч падає у воду» — процедурна генерація, візуал v2.
 * Леєри: небо (сонце+хмарка+птахи) → тонкий багатошаровий горизонт із
 * сонячною доріжкою і піною → вода: мʼякі god-rays із диханням, каустична
 * СІТКА плям, 2 паралакс-шари частинок, глибинний градієнт у темно-синє,
 * віньєтка дна → мʼяч: падіння → сплеск → занурення, ДУЖЕ повільне внизу.
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

    const SKY = 46, T_DROP = 1.6, T_HIT = T_DROP + 0.5;
    type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; splash?: boolean };
    let parts: P[] = [];
    const plankFar = Array.from({ length: 22 }, (_, i) => ({ x: (i * 41) % W, y: SKY + 10 + ((i * 61) % (H - SKY - 16)), s: 0.3 + ((i * 17) % 7) / 30 }));
    const plankNear = Array.from({ length: 14 }, (_, i) => ({ x: (i * 53) % W, y: SKY + 20 + ((i * 47) % (H - SKY - 30)), s: 0.9 + ((i * 23) % 8) / 14 }));
    let t = 0;
    let raf = 0;
    const surfY = (x: number) =>
      SKY + Math.sin(x * 0.22 + t * 2.1) * 1.4 + Math.sin(x * 0.07 - t * 1.3) * 1.0 + Math.sin(x * 0.45 + t * 3.2) * 0.4;

    function frame() {
      t += 1 / 60;

      /* ---- НЕБО ---- */
      for (let y = 0; y < SKY + 4; y += 1) {
        const k = y / SKY;
        ctx.fillStyle = `rgb(${Math.round(150 - 42 * k)},${Math.round(214 - 44 * k)},${Math.round(238 - 34 * k)})`;
        ctx.fillRect(0, y, W, 1);
      }
      ctx.fillStyle = 'rgba(255,246,216,0.35)'; ctx.beginPath(); ctx.arc(28, 14, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(28, 14, 6, 0, Math.PI * 2); ctx.fill();
      const cx = ((t * 2.0) % (W + 60)) - 30;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(Math.round(cx), 10, 26, 4); ctx.fillRect(Math.round(cx) + 5, 7, 14, 3); ctx.fillRect(Math.round(cx) + 4, 14, 18, 3);
      ctx.fillStyle = 'rgba(40,60,70,0.65)';
      ctx.fillRect(Math.round(96 + Math.sin(t * 0.7) * 8), 20, 3, 1); ctx.fillRect(Math.round(112 + Math.sin(t * 0.7) * 8), 24, 3, 1);

      /* ---- ВОДА: глибинний градієнт у темно-синє ---- */
      for (let y = SKY - 4; y < H; y += 1) {
        const k = Math.min(1, (y - SKY) / (H - SKY));
        const kk = k * k;
        ctx.fillStyle = `rgb(${Math.round(42 - 34 * kk)},${Math.round(150 - 116 * kk)},${Math.round(188 - 132 * kk)})`;
        ctx.fillRect(0, Math.max(y, 0), W, 1);
      }
      /* віньєтка дна */
      for (let y = H - 46; y < H; y += 2) {
        const a = ((y - (H - 46)) / 46) * 0.35;
        ctx.fillStyle = `rgba(2,10,26,${a})`;
        ctx.fillRect(0, y, W, 2);
      }

      /* ---- ГОРИЗОНТ: тонка кромка + піна + доріжка сонця ---- */
      for (let x = 0; x < W; x += 1) {
        const sy = surfY(x);
        ctx.fillStyle = '#9fd2ea';
        ctx.fillRect(x, SKY - 4, 1, Math.max(0, Math.round(sy) - (SKY - 4)));
        ctx.fillStyle = 'rgba(235,251,255,0.95)';
        ctx.fillRect(x, Math.round(sy), 1, 1);
        ctx.fillStyle = 'rgba(190,232,248,0.5)';
        ctx.fillRect(x, Math.round(sy) + 1, 1, 1);
        ctx.fillStyle = 'rgba(150,210,236,0.22)';
        ctx.fillRect(x, Math.round(sy) + 2, 1, 2);
        /* піна: рідкі яскраві цятки на гребенях */
        if (Math.sin(x * 0.9 + t * 2.6) > 0.93) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, Math.round(sy) - 1, 1, 1); }
      }
      /* сонячна доріжка під поверхнею: мерехтливі штрихи вузьким конусом від сонця */
      for (let y = SKY + 3; y < SKY + 46; y += 2) {
        const spread = 4 + (y - SKY) * 0.55;
        for (let i = 0; i < 2; i++) {
          const gx = 28 + Math.sin(y * 1.7 + t * (3 + i)) * spread;
          if (Math.sin(y * 2.3 + t * 4 + i * 2) > 0.2) {
            ctx.fillStyle = `rgba(255,250,225,${0.22 - (y - SKY) * 0.004})`;
            ctx.fillRect(Math.round(gx), y, 2, 1);
          }
        }
      }

      /* ---- GOD-RAYS: мʼякі, дихають шириною і яскравістю ---- */
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin(t * 0.4 + i * 1.9) * 12;
        const x0 = 16 + i * 40 + sway;
        const breathe = 0.5 + 0.5 * Math.sin(t * 0.65 + i * 2.2);
        const wBase = 3 + breathe * 4;
        for (let y = SKY + 4; y < H * 0.78; y += 2) {
          const prog = (y - SKY) / (H * 0.78 - SKY);
          const a = (0.075 - i * 0.008) * breathe * (1 - prog) * (1 - prog);
          if (a <= 0.004) continue;
          const wRay = wBase + prog * 7;
          const xx = x0 + (y - SKY) * (0.14 + i * 0.02);
          ctx.fillStyle = `rgba(215,244,255,${a})`;
          ctx.fillRect(Math.round(xx), y, Math.round(wRay), 2);
          ctx.fillStyle = `rgba(215,244,255,${a * 0.45})`;
          ctx.fillRect(Math.round(xx) - 2, y, 2, 2); ctx.fillRect(Math.round(xx + wRay), y, 2, 2);
        }
      }

      /* ---- КАУСТИЧНА СІТКА: плями-вузли, що пливуть ---- */
      for (let gy = 0; gy < 4; gy++) {
        const bandY = SKY + 14 + gy * 26;
        const fade = 1 - gy * 0.22;
        for (let x = 0; x < W; x += 4) {
          const n = Math.sin(x * 0.32 + t * 1.5 + gy) * Math.sin(x * 0.13 - t * 0.9 + gy * 3) + Math.sin(x * 0.07 + t * 0.5);
          if (n > 1.05) {
            const yy = bandY + Math.sin(x * 0.09 + t * 1.1 + gy) * 6;
            ctx.fillStyle = `rgba(205,242,255,${0.12 * fade})`;
            ctx.fillRect(x, Math.round(yy), 4, 2);
            ctx.fillStyle = `rgba(205,242,255,${0.05 * fade})`;
            ctx.fillRect(x - 2, Math.round(yy) + 2, 8, 1);
          }
        }
      }

      /* ---- частинки: 2 паралакс-шари ---- */
      ctx.fillStyle = 'rgba(200,232,246,0.16)';
      for (const p of plankFar) ctx.fillRect(Math.round((p.x + t * 2 * p.s) % W), Math.round(p.y + Math.sin(t * 0.5 + p.x) * 1.5), 1, 1);
      ctx.fillStyle = 'rgba(220,245,255,0.30)';
      for (const p of plankNear) ctx.fillRect(Math.round((p.x + t * 5 * p.s) % W), Math.round(p.y + Math.sin(t * 0.8 + p.x) * 2.5), 1, 1);

      /* ---- МʼЯЧ ---- */
      let ballX = W / 2, ballY = -20, ballR = 4.5, show = false, depth = 0;
      if (t >= T_DROP && t < T_HIT) {
        show = true;
        const p = (t - T_DROP) / (T_HIT - T_DROP);
        ballY = -8 + p * p * (SKY + 8);
      } else if (t >= T_HIT) {
        show = true;
        const d = t - T_HIT;
        /* двофазне занурення: швидкий вхід, ДУЖЕ повільний дрейф унизу */
        depth = 1 - (0.55 * Math.exp(-d / 2.2) + 0.45 * Math.exp(-d / 14));
        ballY = SKY + depth * (H * 0.72);
        ballX = W / 2 + Math.sin(d * 1.0) * (6 * (1 - depth * 0.85));
        ballR = 4.5 - depth * 3.2;
      }

      if (t >= T_HIT - 0.02 && t < T_HIT + 0.06 && parts.filter((p) => p.splash).length === 0) {
        for (let i = 0; i < 16; i++) parts.push({ x: W / 2, y: SKY, vx: (Math.random() - 0.5) * 2.6, vy: -(1.2 + Math.random() * 2.4), r: Math.random() < 0.4 ? 2 : 1, life: 1, splash: true });
        for (let i = 0; i < 10; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 8, y: SKY + 4, vx: (Math.random() - 0.5) * 0.5, vy: 0.6 + Math.random() * 1.2, r: 1, life: 1 });
      }
      const hitPulse = t > T_HIT && t < T_HIT + 1.1 ? (1 - (t - T_HIT) / 1.1) : 0;
      if (hitPulse > 0) {
        for (const dir of [-1, 1]) {
          const rr = (1 - hitPulse) * 40 + 6;
          const hx = W / 2 + dir * rr;
          ctx.fillStyle = `rgba(240,253,255,${hitPulse * 0.8})`;
          ctx.fillRect(Math.round(hx) - 1, Math.round(surfY(hx)) - 1, 3, 1);
          ctx.fillStyle = `rgba(240,253,255,${hitPulse * 0.35})`;
          ctx.fillRect(Math.round(hx) - 2, Math.round(surfY(hx)), 5, 1);
        }
      }
      /* слід бульбашок: рідшає і дрібнішає з глибиною */
      if (show && t > T_HIT && Math.random() < Math.max(0.06, 0.5 - depth * 0.5)) {
        parts.push({ x: ballX + (Math.random() - 0.5) * 4, y: ballY - ballR, vx: (Math.random() - 0.5) * 0.25, vy: -(0.3 + Math.random() * 0.5), r: 1, life: 1 });
      }
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        if (p.splash) { p.vy += 0.1; if (p.y > surfY(p.x) + 1 && p.vy > 0) p.life = 0; }
        if (!p.splash && p.y < surfY(p.x) + 2) p.life = 0;
        p.x += p.vx; p.y += p.vy; p.life -= p.splash ? 0.02 : 0.006;
        ctx.fillStyle = `rgba(228,249,255,${0.8 * p.life})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.r, p.r);
      }

      if (show && ballR > 0.7) {
        const glow = Math.max(0.25, 1 - depth * 0.9);
        ctx.globalAlpha = ballY < SKY ? 1 : 0.3 + glow * 0.7;
        /* мʼякий ореол на глибині */
        if (depth > 0.35) { ctx.fillStyle = `rgba(200,235,250,${0.10 * glow})`; ctx.beginPath(); ctx.arc(ballX, ballY, ballR + 2.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#f2fafd';
        ctx.beginPath(); ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2); ctx.fill();
        if (ballR > 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ballX - ballR * 0.4), Math.round(ballY - ballR * 0.55), 2, 1); }
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

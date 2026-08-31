'use client';

import { useEffect, useRef } from 'react';

/**
 * КАДР 2 · «Мʼяч падає у воду» — процедурна генерація.
 * Верх: НЕБО з сонцем і хмаркою, чіткий ГОРИЗОНТ (жива хвиляста поверхня).
 * Низ: товща води В РУСІ — каустики пливуть, планктон дрейфує, промені
 * світла гойдаються. Мʼяч падає з неба → сплеск → тоне вглиб і меншає.
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

    const SKY = 46;            // висота неба; горизонт ~SKY
    const T_DROP = 1.6;
    const T_HIT = T_DROP + 0.5; // політ у небі довший — його видно

    type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; splash?: boolean };
    let parts: P[] = [];
    /* планктон: детермінований дрейф */
    const plank = Array.from({ length: 26 }, (_, i) => ({
      x: (i * 37) % W, y: SKY + 14 + ((i * 53) % (H - SKY - 20)), s: 0.55 + ((i * 29) % 10) / 18,
    }));
    let t = 0;
    let raf = 0;

    const surfY = (x: number) => SKY + Math.sin(x * 0.22 + t * 2.1) * 1.6 + Math.sin(x * 0.07 - t * 1.3) * 1.1;

    function frame() {
      t += 1 / 60;

      /* ---- НЕБО ---- */
      for (let y = 0; y < SKY + 4; y += 2) {
        const k = y / SKY;
        ctx.fillStyle = `rgb(${Math.round(150 - 40 * k)},${Math.round(214 - 40 * k)},${Math.round(238 - 30 * k)})`;
        ctx.fillRect(0, y, W, 2);
      }
      /* сонце */
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(28, 14, 7, 0, Math.PI * 2); ctx.fill();
      /* хмарка дрейфує */
      const cx = ((t * 2.2) % (W + 60)) - 30;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(Math.round(cx), 10, 26, 4); ctx.fillRect(Math.round(cx) + 5, 7, 14, 3); ctx.fillRect(Math.round(cx) + 4, 14, 18, 3);

      /* ---- ВОДА (від хвилястого горизонту вниз) ---- */
      for (let y = SKY - 4; y < H; y += 2) {
        const k = (y - SKY) / (H - SKY);
        if (y >= SKY - 4) {
          ctx.fillStyle = `rgb(${Math.round(16 + 26 * (1 - k))},${Math.round(88 + 62 * (1 - k))},${Math.round(120 + 68 * (1 - k))})`;
          ctx.fillRect(0, Math.max(y, SKY - 4), W, 2);
        }
      }
      /* горизонт: жива світла кромка поверхні поверх стику */
      for (let x = 0; x < W; x += 2) {
        const sy = surfY(x);
        /* небо просвічує над хвилею */
        ctx.fillStyle = '#9fd2ea';
        ctx.fillRect(x, SKY - 4, 2, Math.max(0, Math.round(sy) - (SKY - 4)));
        ctx.fillStyle = 'rgba(228,248,255,0.9)';
        ctx.fillRect(x, Math.round(sy), 2, 2);
        ctx.fillStyle = 'rgba(180,225,245,0.35)';
        ctx.fillRect(x, Math.round(sy) + 2, 2, 2);
      }

      /* РУХ ВОДИ: каустики — три світлі стрічки пливуть */
      for (let i = 0; i < 3; i++) {
        const bandY = SKY + 26 + i * 58;
        for (let x = 0; x < W; x += 3) {
          const v = Math.sin(x * 0.35 - t * (1.6 + i * 0.4) + i * 2.1) + Math.sin(x * 0.11 + t * 0.9);
          if (v > 1.15) {
            ctx.fillStyle = `rgba(200,240,255,${0.10 - i * 0.02})`;
            ctx.fillRect(x, Math.round(bandY + Math.sin(x * 0.05 + t) * 5), 3, 2);
          }
        }
      }
      /* промені світла від поверхні, гойдаються */
      for (let i = 0; i < 3; i++) {
        const sway = Math.sin(t * 0.5 + i * 1.7) * 10;
        const x0 = 25 + i * 52 + sway;
        const al = 0.05 + 0.025 * Math.sin(t * 0.8 + i);
        ctx.fillStyle = `rgba(210,242,255,${Math.max(0.02, al)})`;
        for (let y = SKY + 4; y < H * 0.72; y += 2) {
          ctx.fillRect(Math.round(x0 + (y - SKY) * 0.16), y, 4 + (i % 2), 2);
        }
      }
      /* планктон дрейфує */
      ctx.fillStyle = 'rgba(215,240,250,0.25)';
      for (const p of plank) {
        const px = (p.x + t * 3 * p.s) % W;
        const py = p.y + Math.sin(t * 0.7 + p.x) * 2;
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }

      /* ---- МʼЯЧ ---- */
      let ballX = W / 2, ballY = -20, ballR = 4.5, show = false;
      if (t >= T_DROP && t < T_HIT) {
        show = true;
        const p = (t - T_DROP) / (T_HIT - T_DROP);
        ballY = -8 + p * p * (SKY + 8);   // прискорюється в небі
      } else if (t >= T_HIT) {
        show = true;
        const d = t - T_HIT;
        const depth = 1 - Math.exp(-d / 5.2);
        ballY = SKY + depth * (H * 0.68);
        ballX = W / 2 + Math.sin(d * 1.15) * (6 * (1 - depth * 0.7));
        ballR = 4.5 - depth * 3.1;
      }

      /* сплеск */
      if (t >= T_HIT - 0.02 && t < T_HIT + 0.06 && parts.filter((p) => p.splash).length === 0) {
        for (let i = 0; i < 16; i++) parts.push({ x: W / 2, y: SKY, vx: (Math.random() - 0.5) * 2.6, vy: -(1.2 + Math.random() * 2.4), r: Math.random() < 0.4 ? 2 : 1, life: 1, splash: true });
        for (let i = 0; i < 10; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 8, y: SKY + 4, vx: (Math.random() - 0.5) * 0.5, vy: 0.6 + Math.random() * 1.2, r: 1, life: 1 });
      }
      const hitPulse = t > T_HIT && t < T_HIT + 0.9 ? (1 - (t - T_HIT) / 0.9) : 0;
      if (hitPulse > 0) {
        const rr = (1 - hitPulse) * 36 + 6;
        ctx.fillStyle = `rgba(235,252,255,${hitPulse * 0.85})`;
        ctx.fillRect(Math.round(W / 2 - rr), Math.round(surfY(W / 2 - rr)), 3, 1);
        ctx.fillRect(Math.round(W / 2 + rr), Math.round(surfY(W / 2 + rr)), 3, 1);
      }
      /* слід бульбашок */
      if (show && t > T_HIT && Math.random() < Math.max(0.12, 0.5 - (t - T_HIT) * 0.05)) {
        parts.push({ x: ballX + (Math.random() - 0.5) * 4, y: ballY - ballR, vx: (Math.random() - 0.5) * 0.25, vy: -(0.35 + Math.random() * 0.5), r: 1, life: 1 });
      }
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        if (p.splash) { p.vy += 0.1; if (p.y > surfY(p.x) + 1 && p.vy > 0) p.life = 0; }
        if (!p.splash && p.y < surfY(p.x) + 2) p.life = 0; // бульбашки зникають на поверхні
        p.x += p.vx; p.y += p.vy; p.life -= p.splash ? 0.02 : 0.007;
        ctx.fillStyle = `rgba(228,249,255,${0.8 * p.life})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.r, p.r);
      }

      if (show && ballR > 0.8) {
        const deepFade = Math.max(0, 1 - Math.max(0, t - T_HIT) / 16);
        ctx.globalAlpha = ballY < SKY ? 1 : 0.35 + deepFade * 0.65;
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

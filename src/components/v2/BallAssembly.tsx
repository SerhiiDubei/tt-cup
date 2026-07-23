'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Прелоадер-герой: помаранчевий мʼяч для настільного тенісу падає згори,
 * двічі відбивається (сквош), лускає — і хмара маленьких білих мʼячиків
 * злітається в напис «TT CUP». Тап у будь-який момент = пропустити.
 */

type P = {
  tx: number; // ціль (піксель напису)
  ty: number;
  ox: number; // старт (точка вибуху + розліт)
  oy: number;
  cx: number; // контрольна точка дуги
  cy: number;
  delay: number; // 0..1 частка вікна збирання
  r: number;
  orange: boolean;
};

const INK = '#16110D';
const ORANGE = '#FF8A2A';
const WHITE = '#FFF8EC';

// Таймлайн, мс
const T_DROP = 950; // падіння + перший відскок
const T_BOUNCE = 500; // другий відскок до вибуху
const T_BURST = T_DROP + T_BOUNCE;
const T_ASSEMBLE = 1500; // вікно розльоту по цілях
const T_DONE = T_BURST + T_ASSEMBLE + 250;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInQuad(t: number) {
  return t * t;
}

/** Семплимо пікселі напису з офскрін-канваса → точки-цілі для мʼячиків. */
function sampleTitle(w: number, h: number): { pts: { x: number; y: number }[]; fontPx: number } {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const c = off.getContext('2d');
  if (!c) return { pts: [], fontPx: 0 };
  let fontPx = Math.min(w * 0.23, h * 0.28);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  do {
    c.font = `900 ${fontPx}px Unbounded, system-ui, sans-serif`;
    if (c.measureText('TT CUP').width <= w * 0.92) break;
    fontPx -= 4;
  } while (fontPx > 24);
  c.fillStyle = '#fff';
  c.fillText('TT CUP', w / 2, h / 2);
  const data = c.getImageData(0, 0, w, h).data;
  const pts: { x: number; y: number }[] = [];
  // Крок сітки підбираємо під бюджет ~650 частинок
  let step = Math.max(4, Math.round(fontPx / 16));
  for (let tries = 0; tries < 4; tries++) {
    pts.length = 0;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    if (pts.length <= 700) break;
    step += 1;
  }
  return { pts, fontPx };
}

export default function BallAssembly({
  onEnter,
  sub = 'турнір з настільного тенісу',
  hint = 'тапни, щоб дізнатись, що це за двіж',
}: {
  onEnter: () => void;
  sub?: string;
  hint?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false); // напис зібрано → показуємо хінт
  const skipRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Цілі — напис у центрі, трохи вище середини
    const titleH = Math.round(H * 0.5);
    const { pts } = sampleTitle(W, titleH);
    const titleTop = H * 0.5 - titleH / 2 - H * 0.04;

    const ballX = W / 2;
    const floorY = H * 0.62; // рівень «підлоги», де бахкає мʼяч
    const R = Math.max(26, Math.min(46, W * 0.055)); // радіус великого мʼяча

    const parts: P[] = pts.map((p) => {
      const a = Math.random() * Math.PI * 2;
      const spread = R * (1.5 + Math.random() * 3.5);
      const ox = ballX + Math.cos(a) * spread;
      const oy = floorY + Math.sin(a) * spread * 0.7;
      const tx = p.x;
      const ty = p.y + titleTop;
      return {
        tx,
        ty,
        ox,
        oy,
        // контрольна точка — вбік від прямої, щоб летіли дугами
        cx: (ox + tx) / 2 + (Math.random() - 0.5) * W * 0.35,
        cy: (oy + ty) / 2 - Math.random() * H * 0.25,
        delay: Math.random() * 0.45,
        r: 2.2 + Math.random() * 2.4,
        orange: Math.random() < 0.07,
      };
    });

    const start = performance.now();
    let raf = 0;

    function drawBall(x: number, y: number, r: number, squashY: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1 + (1 - squashY) * 0.6, squashY);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = ORANGE;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // шов мʼяча
      ctx.beginPath();
      ctx.arc(-r * 0.25, 0, r * 0.82, -0.9, 0.9);
      ctx.strokeStyle = 'rgba(22,17,13,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // блік
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fill();
      ctx.restore();
    }

    function drawParticles(progress: number) {
      if (!ctx) return;
      for (const p of parts) {
        const local = Math.max(0, Math.min(1, (progress - p.delay) / (1 - p.delay)));
        if (local <= 0) continue;
        const t = easeOutCubic(local);
        // квадратична крива Безьє
        const mt = 1 - t;
        const x = mt * mt * p.ox + 2 * mt * t * p.cx + t * t * p.tx;
        const y = mt * mt * p.oy + 2 * mt * t * p.cy + t * t * p.ty;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.orange ? ORANGE : WHITE;
        ctx.fill();
      }
    }

    function finishFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      drawParticles(1);
      if (!doneRef.current) {
        doneRef.current = true;
        setReady(true);
      }
    }

    function frame(now: number) {
      if (!ctx) return;
      const t = now - start;
      if (reduced || skipRef.current || t >= T_DONE) {
        finishFrame();
        return; // стоп-кадр: напис зібрано
      }
      ctx.clearRect(0, 0, W, H);

      if (t < T_DROP) {
        // Падіння з відскоком: до підлоги + перший відскок
        const p = t / T_DROP;
        let y: number;
        let squash = 1;
        if (p < 0.62) {
          y = -R + easeInQuad(p / 0.62) * (floorY - R * 0.0 + R) - R;
          y = -R * 2 + easeInQuad(p / 0.62) * (floorY + R * 2);
        } else {
          // відскок угору і назад
          const bp = (p - 0.62) / 0.38;
          const arc = Math.sin(bp * Math.PI);
          y = floorY - arc * H * 0.16;
          if (bp < 0.12) squash = 0.55 + (bp / 0.12) * 0.45;
        }
        if (p >= 0.6 && p < 0.65) squash = 0.55;
        drawBall(ballX, Math.min(y, floorY), R, squash);
      } else if (t < T_BURST) {
        // Другий короткий відскок перед вибухом
        const p = (t - T_DROP) / T_BOUNCE;
        const arc = Math.sin(p * Math.PI);
        const y = floorY - arc * H * 0.07;
        const squash = p > 0.9 ? 0.5 : p < 0.1 ? 0.6 + p * 4 : 1;
        drawBall(ballX, y, R * (1 - p * 0.15), squash);
      } else {
        // Вибух → збирання напису
        const p = Math.min(1, (t - T_BURST) / T_ASSEMBLE);
        drawParticles(p);
        if (p >= 1 && !doneRef.current) {
          doneRef.current = true;
          setReady(true);
        }
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleTap() {
    if (doneRef.current) {
      onEnter();
    } else {
      skipRef.current = true; // достроково добираємо напис; наступний тап — вхід
      doneRef.current = true;
      setReady(true);
    }
  }

  return (
    <button type="button" className="v2-intro" onPointerDown={handleTap} aria-label="Пропустити вступ">
      <canvas ref={canvasRef} className="v2-canvas" aria-hidden />
      <div className={`v2-intro-bottom ${ready ? 'show' : ''}`}>
        <p className="v2-intro-sub">{sub}</p>
        <p className="v2-intro-hint">{hint}</p>
      </div>
    </button>
  );
}

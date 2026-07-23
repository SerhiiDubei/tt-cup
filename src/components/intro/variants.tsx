'use client';

import { useEffect, useRef } from 'react';

/**
 * Лабораторія інтро: три варіанти збирання напису «TT CUP».
 * Плавність за принципами класичної анімації bouncing ball
 * (реф: Ross Plaskow, Animation Basics):
 * — рух мʼяча = справжня фізика (швидкість + гравітація), не таймлайн;
 * — squash & stretch зі збереженням обʼєму (sx = 1/sy);
 * — розтяг ВЗДОВЖ вектора руху, сквош у момент контакту;
 * — кожен відскік нижчий (реституція), час у повітрі фізичний:
 *   швидко біля підлоги, зависання у верхівці дуги.
 */

const CREAM = '#FFF8EC';
const INK = '#16110D';

/** Назва турніру (рішення Сергія 2026-07-17). Рядки штабелем — читається на телефоні. */
const TITLE_LINES = ['DRUID', 'BATTLE', 'CUP'];

/** Бренд-палітра хвилі. */
const WAVE_COLORS = ['#FF2E88', '#FFC619', '#00CFC1', '#2D4BFF', '#FF5A36', '#A6E22E', '#8A45FF'];

type Pt = { x: number; y: number };

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInQuad = (t: number) => t * t;
const backOut = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Семпл пікселів напису → точки-цілі. Крок фіксований → однакові кульки. */
async function sampleTitle(W: number, H: number): Promise<{ pts: Pt[]; r: number }> {
  try {
    await document.fonts.load('900 100px Unbounded');
  } catch {
    /* шрифт підтягнеться сам */
  }
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const c = off.getContext('2d');
  if (!c) return { pts: [], r: 5 };
  const LH = 1.12;
  let fontPx = Math.min(W * 0.3, H * 0.17);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  do {
    c.font = `900 ${fontPx}px Unbounded, system-ui, sans-serif`;
    const wMax = Math.max(...TITLE_LINES.map((l) => c.measureText(l).width));
    if (wMax <= W * 0.9 && fontPx * LH * TITLE_LINES.length <= H * 0.52) break;
    fontPx -= 4;
  } while (fontPx > 20);
  c.fillStyle = '#fff';
  TITLE_LINES.forEach((l, i) => {
    c.fillText(l, W / 2, H / 2 + (i - (TITLE_LINES.length - 1) / 2) * fontPx * LH);
  });
  const data = c.getImageData(0, 0, W, H).data;
  let step = Math.max(3, Math.round(fontPx / 13));
  const pts: Pt[] = [];
  for (let tries = 0; tries < 5; tries++) {
    pts.length = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    if (pts.length <= 950) break;
    step += 1;
  }
  // +30% обʼєму кульки; прорізи літер тримає щільність семплінгу
  return { pts, r: step * 0.65 };
}

/** Затемнення/освітлення hex-кольору на частку k (-1..1). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const x = k < 0 ? v * (1 + k) : v + (255 - v) * k;
    return Math.round(Math.max(0, Math.min(255, x)));
  };
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * ОБʼЄМНА мінікулька: радіальний градієнт світла (джерело зверху-зліва),
 * темний обід знизу-справа, чіткий блік, тонкий контур. Не «плоске коло».
 */
function makeMiniBall(r: number, dpr: number, color: string = CREAM): HTMLCanvasElement {
  const s = Math.ceil(r * 2 * dpr) + 8;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const c = cv.getContext('2d')!;
  const cx = s / 2;
  const rr = r * dpr;

  // тіло з обʼємом: світло зверху-зліва → базовий колір → тінь на ободі
  const g = c.createRadialGradient(cx - rr * 0.38, cx - rr * 0.42, rr * 0.1, cx, cx, rr * 1.05);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.35, shade(color, 0.12));
  g.addColorStop(0.75, color);
  g.addColorStop(1, shade(color, -0.42));
  c.beginPath();
  c.arc(cx, cx, rr, 0, Math.PI * 2);
  c.fillStyle = g;
  c.fill();

  // мʼяка внутрішня тінь знизу-справа (докручує сферу)
  const gs = c.createRadialGradient(cx + rr * 0.45, cx + rr * 0.5, rr * 0.2, cx + rr * 0.3, cx + rr * 0.35, rr * 1.1);
  gs.addColorStop(0, 'rgba(0,0,0,0.22)');
  gs.addColorStop(0.6, 'rgba(0,0,0,0.05)');
  gs.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.beginPath();
  c.arc(cx, cx, rr, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = gs;
  c.fillRect(0, 0, s, s);
  c.restore();

  // контур
  c.beginPath();
  c.arc(cx, cx, rr - Math.max(0.6, rr * 0.09) / 2, 0, Math.PI * 2);
  c.lineWidth = Math.max(1.2, rr * 0.16);
  c.strokeStyle = 'rgba(22,17,13,0.9)';
  c.stroke();

  // блік: чіткий + мʼякий ореол
  c.beginPath();
  c.ellipse(cx - rr * 0.34, cx - rr * 0.4, rr * 0.22, rr * 0.15, -0.6, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.fill();
  c.beginPath();
  c.arc(cx - rr * 0.2, cx - rr * 0.24, rr * 0.42, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fill();
  return cv;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/**
 * Малює мʼяч з деформацією вздовж вектора руху + обертанням.
 * stretch > 1 — витягнутий за рухом; < 1 — сквош; обʼєм збережено.
 */
function drawDeformedBall(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  R: number,
  angle: number,
  stretch: number,
  spin: number,
  alpha = 1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(stretch, 1 / stretch);
  ctx.rotate(spin - angle);
  ctx.drawImage(img, -R, -R, R * 2, R * 2);
  ctx.restore();
}

/** Розтяг від швидкості: повільно = кругле, швидко = витягнуте (до 1.28). */
const stretchFromSpeed = (speed: number, vMax: number) => 1 + Math.min(0.28, (speed / vMax) * 0.28);

type VariantProps = { onDone?: () => void };

/** Прапорці запуску: current = тап (домалювати фінал), dead = розмонтовано. */
type RunBox = { current: boolean; dead: boolean };

function useIntroCanvas(
  run: (ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, skipRef: RunBox) => Promise<void> | void
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<RunBox>({ current: false, dead: false });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingQuality = 'high';
    const box: RunBox = { current: false, dead: false };
    boxRef.current = box;
    void run(ctx, W, H, dpr, box);
    return () => {
      box.dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    canvasRef,
    skip: () => {
      boxRef.current.current = true;
    },
  };
}

function drawFinal(ctx: CanvasRenderingContext2D, pts: Pt[], mini: HTMLCanvasElement, r: number) {
  for (const p of pts) ctx.drawImage(mini, p.x - r, p.y - r, r * 2, r * 2);
}

// ═══════════════ ВАРІАНТ 1: «ДОЩ» (обраний) ═══════════════
// Кульки сиплються хвилею і сідають у напис; потім кольорова хвиля
// кривою лінією проїжджає через напис і фарбує кульки бренд-палітрою.
export function IntroRain({ onDone }: VariantProps) {
  const { canvasRef, skip } = useIntroCanvas(async (ctx, W, H, dpr, skipRef) => {
    const { pts, r } = await sampleTitle(W, H);
    const creamMini = makeMiniBall(r, dpr);
    const colorMinis = WAVE_COLORS.map((c) => makeMiniBall(r, dpr, c));

    // Драматургія падіння: перший падає САМ, пауза, далі каскад, що
    // розганяється (спершу по одному, під кінець — злива).
    const order = pts.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const SOLO_GAP = 700; // скільки перший летить сам
    const CASCADE = 2100; // вікно каскаду
    const rank = new Array<number>(pts.length);
    order.forEach((ptIdx, k) => (rank[ptIdx] = k));
    const drops = pts.map((p, i) => {
      const k = rank[i];
      const delay =
        k === 0
          ? 0
          : SOLO_GAP + CASCADE * Math.pow((k - 1) / Math.max(1, pts.length - 2), 0.38) + Math.random() * 70;
      // серія відскоків, що згасають: висота ×~0.42, період ∝ √висоти
      const bounceH: number[] = [];
      const bounceT: number[] = [];
      let h = r * (2.6 + Math.random() * 2.2);
      const decay = 0.38 + Math.random() * 0.1;
      while (h > 0.8 && bounceH.length < 4) {
        bounceH.push(h);
        bounceT.push(250 * Math.sqrt(h / (r * 4.8)) + 55);
        h *= decay;
      }
      return {
        ...p,
        delay,
        fallFrom: -30 - Math.random() * H * 0.25,
        dur: 560 + Math.random() * 200,
        bounceH,
        bounceT,
        colorIdx: -1,
        paintedAt: -1,
        glitchAt: -1,
        seed: Math.random() * 1000,
      };
    });
    const RAIN_T = SOLO_GAP + CASCADE + 1500;
    const WAVE_START = RAIN_T + 250;
    const WAVE_DUR = 1100;
    const GLITCH_T = 260; // тривалість глітчу кульки після проходу фронту
    const AMP = W * 0.16; // амплітуда кривої
    const total = WAVE_START + WAVE_DUR + GLITCH_T + 500;
    const start = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Х-позиція кривої хвилі для даного y у момент прогресу wp. */
    const waveX = (wp: number, y: number) =>
      lerp(-AMP * 1.6, W + AMP * 1.6, wp) + AMP * Math.sin(y * 0.016 + 1.4);

    /** Колір за позицією вздовж мʼякої кривої → 5 широких смуг палітри. */
    const BANDS = 5;
    const colorFor = (d: { x: number; y: number }) => {
      const along = (d.x + AMP * 0.5 * Math.sin(d.y * 0.006 + 1.2)) / W;
      return Math.min(BANDS - 1, Math.floor(clamp01(along) * BANDS));
    };

    const paintAll = () => {
      for (const d of drops) {
        if (d.colorIdx < 0) d.colorIdx = colorFor(d);
      }
    };

    /** Псевдовипадок, стабільний у межах кадру глітчу. */
    const gRand = (seed: number, slot: number) => {
      const x = Math.sin(seed * 12.9898 + slot * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    const drawBalls = (t: number, resting: boolean) => {
      for (const d of drops) {
        let x = d.x;
        let y = d.y;
        let sy = 1;
        if (!resting) {
          const lt = t - d.delay;
          if (lt <= 0) continue;
          if (lt < d.dur) {
            // падіння з прискоренням (гравітація) + розтяг за швидкістю
            const e = easeInQuad(lt / d.dur);
            y = lerp(d.fallFrom, d.y, e);
            sy = 1 + 0.24 * (lt / d.dur);
          } else {
            // серія відскоків, що згасають
            let bt = lt - d.dur;
            let k = 0;
            while (k < d.bounceT.length && bt >= d.bounceT[k]) {
              bt -= d.bounceT[k];
              k++;
            }
            if (k < d.bounceT.length) {
              const u = bt / d.bounceT[k];
              y = d.y - d.bounceH[k] * Math.sin(u * Math.PI);
              // сквош на контакті, слабший з кожним відскоком
              if (u < 0.2) {
                const sq = Math.min(0.94, 0.58 + k * 0.13);
                sy = lerp(sq, 1, backOut(u / 0.2));
              } else if (u > 0.85) {
                sy = lerp(1, 0.9, (u - 0.85) / 0.15); // легке підтискання перед контактом
              }
            }
            // після останнього відскоку — лежить рівно
          }
        }

        const inGlitch = d.glitchAt > 0 && t - d.glitchAt < GLITCH_T;
        let sprite: HTMLCanvasElement;
        if (inGlitch) {
          // ГЛІТЧ: колір мерехтить, позиція сіпається квантовано,
          // хроматичний двійник поруч
          const slot = Math.floor((t - d.glitchAt) / 45);
          sprite = colorMinis[Math.floor(gRand(d.seed, slot) * colorMinis.length)];
          x += (Math.floor(gRand(d.seed, slot + 31) * 3) - 1) * 4;
          y += (Math.floor(gRand(d.seed, slot + 57) * 3) - 1) * 2;
          const ghost = colorMinis[Math.floor(gRand(d.seed, slot + 11) * colorMinis.length)];
          ctx.globalAlpha = 0.45;
          ctx.drawImage(ghost, x - r + 4, y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
        } else if (d.colorIdx >= 0) {
          sprite = colorMinis[d.colorIdx];
        } else {
          sprite = creamMini;
        }

        // пульс одразу після глітчу
        let scale = 1;
        if (d.paintedAt > 0 && !inGlitch) {
          const pp = clamp01((t - d.paintedAt) / 240);
          scale = 1 + 0.3 * Math.sin(pp * Math.PI);
        }
        const rh = r * sy * scale;
        const rw = (r / sy) * scale;
        ctx.drawImage(sprite, x - rw, y - rh, rw * 2, rh * 2);
      }
    };

    return new Promise<void>((resolve) => {
      const frame = (now: number) => {
        if (skipRef.dead) {
          resolve();
          return;
        }
        const t = now - start;
        ctx.clearRect(0, 0, W, H);
        if (reduced || skipRef.current || t > total) {
          paintAll();
          drawBalls(total, true);
          onDone?.();
          resolve();
          return;
        }

        if (t < WAVE_START) {
          drawBalls(t, false);
        } else {
          // глітч-хвиля: фронт кривої запускає мерехтіння, позаду — колір
          const wp = clamp01((t - WAVE_START) / WAVE_DUR);
          for (const d of drops) {
            if (d.glitchAt < 0 && waveX(wp, d.y) > d.x) {
              d.glitchAt = t; // фронт зачепив → кулька глітчить
              d.colorIdx = colorFor(d); // фінальний колір після глітчу
              d.paintedAt = t + GLITCH_T; // пульс — щойно глітч відпустить
            }
          }
          drawBalls(t, true);
          // сама крива — тонкий світлий слід, що їде попереду фарби
          if (wp < 1) {
            ctx.beginPath();
            for (let y = H * 0.18; y <= H * 0.82; y += 8) {
              const x = waveX(wp, y);
              if (y === H * 0.18) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(255, 248, 236, 0.35)';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  });
  return <canvas ref={canvasRef} className="il-canvas" onPointerDown={skip} />;
}

// ═══════════════ ВАРІАНТ 2: «УДАР» ═══════════════
// Фізичне падіння: гравітація, реституція 0.58, сквош на контакті,
// розтяг у польоті, шлейф. Після другого відскоку — вибух у напис.
export function IntroDrop({ onDone }: VariantProps) {
  const { canvasRef, skip } = useIntroCanvas(async (ctx, W, H, dpr, skipRef) => {
    const [{ pts, r }, ballImg] = await Promise.all([sampleTitle(W, H), loadImg('/v2/intro/ball.png')]);
    const mini = makeMiniBall(r, dpr);
    const R = Math.max(30, Math.min(52, W * 0.06));
    const bx = W / 2;
    const floorY = H * 0.6;

    // стан фізики
    const g = H * 3.4; // px/s²
    const rest = 0.58;
    let by = -R * 2;
    let bv = Math.sqrt(2 * g * H * 0.12); // невеликий стартовий поштовх
    let bounces = 0;
    let burstT = -1; // момент вибуху (ms від старту)
    let impactT = -Infinity; // момент останнього контакту
    const vMax = Math.sqrt(2 * g * (floorY + R * 2));

    const parts = pts.map((p) => {
      const a = Math.random() * Math.PI * 2;
      const sp = R * (1 + Math.random() * 2.5);
      const ox = bx + Math.cos(a) * sp;
      const oy = floorY + Math.sin(a) * sp * 0.6;
      return {
        ...p,
        ox,
        oy,
        cx: (ox + p.x) / 2 + (Math.random() - 0.5) * W * 0.3,
        cy: (oy + p.y) / 2 - Math.random() * H * 0.22,
        delay: Math.random() * 0.4,
      };
    });
    const T_ASM = 1400;
    const trail: { y: number; sy: number }[] = [];
    const start = performance.now();
    let prev = start;
    let spin = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return new Promise<void>((resolve) => {
      const frame = (now: number) => {
        if (skipRef.dead) {
          resolve();
          return;
        }
        const t = now - start;
        const dt = Math.min(32, now - prev) / 1000;
        prev = now;
        ctx.clearRect(0, 0, W, H);
        const finished = burstT > 0 && t > burstT + T_ASM + 300;
        if (reduced || skipRef.current || finished) {
          drawFinal(ctx, pts, mini, r);
          onDone?.();
          resolve();
          return;
        }

        if (burstT < 0) {
          // політ: інтегруємо швидкість і гравітацію
          bv += g * dt;
          by += bv * dt;
          spin += 1.2 * dt;
          if (by >= floorY) {
            by = floorY;
            impactT = t;
            if (bounces >= 2 || Math.abs(bv) < H * 0.7) {
              burstT = t; // енергія вичерпана — вибух
            } else {
              bv = -bv * rest;
              bounces++;
            }
          }
          // деформація: сквош 90мс після контакту, інакше розтяг за швидкістю
          const sinceImpact = t - impactT;
          let stretch: number;
          let angle = Math.PI / 2; // рух вертикальний
          if (sinceImpact < 90) {
            const k = backOut(clamp01(sinceImpact / 90));
            stretch = lerp(0.62, 1, k); // сквош → назад у кругле
          } else {
            stretch = stretchFromSpeed(Math.abs(bv), vMax);
          }
          // шлейф
          trail.push({ y: by, sy: stretch });
          if (trail.length > 6) trail.shift();
          trail.forEach((tr, i) =>
            drawDeformedBall(ctx, ballImg, bx, tr.y, R, angle, tr.sy, spin, ((i + 1) / trail.length) * 0.22)
          );
          drawDeformedBall(ctx, ballImg, bx, by, R, angle, stretch, spin);
        } else {
          const p = clamp01((t - burstT) / T_ASM);
          for (const q of parts) {
            const lt = clamp01((p - q.delay) / (1 - q.delay));
            if (lt <= 0) continue;
            const e = easeOutCubic(lt);
            const mt = 1 - e;
            const x = mt * mt * q.ox + 2 * mt * e * q.cx + e * e * q.x;
            const y = mt * mt * q.oy + 2 * mt * e * q.cy + e * e * q.y;
            ctx.drawImage(mini, x - r, y - r, r * 2, r * 2);
          }
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  });
  return <canvas ref={canvasRef} className="il-canvas" onPointerDown={skip} />;
}

// ═══════════════ ВАРІАНТ 3: «РАЛІ» ═══════════════
// Політ = балістика (швидко біля ракеток, зависає у верхівці),
// деформація вздовж траєкторії, обертання, сквош при ударі.
export function IntroRally({ onDone }: VariantProps) {
  const { canvasRef, skip } = useIntroCanvas(async (ctx, W, H, dpr, skipRef) => {
    const [{ pts, r }, ballImg, padImg] = await Promise.all([
      sampleTitle(W, H),
      loadImg('/v2/intro/ball.png'),
      loadImg('/v2/intro/paddle.png'),
    ]);
    const mini = makeMiniBall(r, dpr);
    const R = Math.max(22, Math.min(36, W * 0.045));
    const HITS = 6;
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    const bands: Pt[][] = Array.from({ length: HITS }, (_, k) =>
      sorted.slice(Math.floor((k * sorted.length) / HITS), Math.floor(((k + 1) * sorted.length) / HITS))
    );
    const padW = Math.min(90, W * 0.15);
    const padY = H * 0.63;
    const leftX = padW * 0.45;
    const rightX = W - padW * 0.45;
    const x0 = leftX + padW * 0.4;
    const x1 = rightX - padW * 0.4;

    const T_HIT = 680; // мс прольоту
    const Ts = T_HIT / 1000;
    // балістика дуги: апекс = 0.2H → g = 8*апекс/T²; vy0 = -g*T/2
    const apex = H * 0.2;
    const gArc = (8 * apex) / (Ts * Ts);
    const vy0 = (-gArc * Ts) / 2;
    const vxAbs = (x1 - x0) / Ts;
    const vyMax = Math.abs(vy0);

    const T_SETTLE = 1100;
    const total = HITS * T_HIT + T_SETTLE;
    const bandBorn: number[] = Array(HITS).fill(-1);
    let shake = 0;
    let spin = 0;
    const start = performance.now();
    let prevNow = start;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // фізика фінального заспокоєння
    const restY = H * 0.7;
    let sBall: { x: number; y: number; vx: number; vy: number } | null = null;

    const drawPaddle = (x: number, y: number, flip: boolean, nudge: number) => {
      ctx.save();
      ctx.translate(x + (flip ? -nudge : nudge), y);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(padImg, -padW / 2, -padW * 0.7, padW, padW * 1.4);
      ctx.restore();
    };

    return new Promise<void>((resolve) => {
      const frame = (now: number) => {
        if (skipRef.dead) {
          resolve();
          return;
        }
        const t = now - start;
        const dt = Math.min(32, now - prevNow) / 1000;
        prevNow = now;
        if (reduced || skipRef.current || t > total + 400) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, W, H);
          drawFinal(ctx, pts, mini, r);
          ctx.drawImage(ballImg, W / 2 - R, restY - R, R * 2, R * 2);
          drawPaddle(leftX, padY, false, 0);
          drawPaddle(rightX, padY, true, 0);
          onDone?.();
          resolve();
          return;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (shake > 0.4) {
          ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
          shake *= 0.8;
        }
        ctx.clearRect(-10, -10, W + 20, H + 20);

        const hitIdx = Math.min(HITS - 1, Math.floor(t / T_HIT));
        for (let k = 0; k <= hitIdx; k++) {
          if (bandBorn[k] < 0 && t >= k * T_HIT) {
            bandBorn[k] = t;
            shake = 7;
          }
        }
        for (let k = 0; k < HITS; k++) {
          if (bandBorn[k] < 0) continue;
          const bt = clamp01((t - bandBorn[k]) / 300);
          const s = backOut(bt);
          for (const p of bands[k]) {
            const rr = r * s;
            if (rr <= 0.2) continue;
            ctx.drawImage(mini, p.x - rr, p.y - rr, rr * 2, rr * 2);
          }
        }

        spin += 3.4 * dt;
        const inSettle = t >= HITS * T_HIT;
        let bxp: number;
        let byp: number;
        let vx: number;
        let vy: number;
        if (!inSettle) {
          const seg = t / T_HIT;
          const k = Math.floor(seg);
          const p = seg - k;
          const fromLeft = k % 2 === 0;
          const xa = fromLeft ? x0 : x1;
          const xb = fromLeft ? x1 : x0;
          const tp = p * Ts;
          bxp = lerp(xa, xb, p);
          byp = padY + vy0 * tp + 0.5 * gArc * tp * tp;
          vx = (fromLeft ? 1 : -1) * vxAbs;
          vy = vy0 + gArc * tp;
        } else {
          // заспокоєння: справжня гравітація до restY
          if (!sBall) {
            sBall = { x: x0, y: padY, vx: (W / 2 - x0) / (T_SETTLE / 1000) / 1.6, vy: -H * 0.9 };
          }
          const gs = H * 3.2;
          sBall.vy += gs * dt;
          sBall.x += sBall.vx * dt;
          sBall.y += sBall.vy * dt;
          sBall.vx *= 1 - 1.4 * dt; // тертя по X
          if (sBall.y >= restY) {
            sBall.y = restY;
            sBall.vy = -sBall.vy * 0.5;
            if (Math.abs(sBall.vy) < H * 0.12) sBall.vy = 0;
          }
          bxp = sBall.x;
          byp = sBall.y;
          vx = sBall.vx;
          vy = sBall.vy;
        }

        // деформація вздовж вектора руху; сквош у мить удару
        const sinceHit = t - Math.floor(t / T_HIT) * T_HIT;
        const speed = Math.hypot(vx, vy);
        const angle = Math.atan2(vy, vx);
        let stretch: number;
        if (!inSettle && sinceHit < 80) {
          stretch = lerp(0.66, 1, backOut(sinceHit / 80));
        } else {
          stretch = stretchFromSpeed(speed, Math.hypot(vxAbs, vyMax));
        }
        drawDeformedBall(ctx, ballImg, bxp, byp, R, angle, stretch, spin);

        const nudge = sinceHit < 130 && !inSettle ? (1 - sinceHit / 130) * 10 : 0;
        const hitWasLeft = Math.floor(t / T_HIT) % 2 === 0;
        drawPaddle(leftX, padY, false, hitWasLeft ? nudge : 0);
        drawPaddle(rightX, padY, true, hitWasLeft ? 0 : nudge);

        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  });
  return <canvas ref={canvasRef} className="il-canvas" onPointerDown={skip} />;
}

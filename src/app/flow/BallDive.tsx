'use client';

import { useEffect, useRef } from 'react';

/**
 * КАДР 2 · «Мʼяч падає у воду» — процедурна генерація, візуал v3 + КАМЕРА.
 * Перші ~3с камера статична (небо, горизонт, падіння, сплеск), далі їде
 * вниз разом із мʼячем; чим глибше — тим темніше, поверхня і промені
 * лишаються вгорі й виходять із кадру.
 * mode 'follow' (V1): камера мʼяко тримає мʼяч у верхній третині.
 * mode 'dolly'  (V2): рівномірний кіно-рух; мʼяч повільно сповзає нижче.
 */
/* 5 варіантів акцентів на ключову інфу (шрифт наративу: Press Start 2P) */
export type AccentVariant = 'caps' | 'stamp' | 'neon' | 'glitch' | 'invert';

const NARR_FONT = "'Press Start 2P', 'Courier New', monospace";

/* рядок наративу: t — текст (розмітка: *слово* = акцент; префікс '~' = тихий
   рядок, '!' = панч-рядок), d — пауза перед рядком у секундах (темп розповіді) */
export type NarrLine = { t: string; d: number };

const DEFAULT_LINES: NarrLine[] = [
  { t: '~Все почалося з одного мʼяча…', d: 0 },
  { t: 'Він упав — і світ *стих*.', d: 2.8 },
  { t: '~Так зникає звичайний вечір.', d: 2.2 },
  { t: 'Повільно. Непомітно. *Назавжди*.', d: 3.4 },
  { t: '~Але на дні кожної тиші…', d: 3.0 },
  { t: '…щось чекає.', d: 1.6 },
  { t: '*Двір. Стіл.* Дві ракетки.', d: 3.2 },
  { t: 'І питання — хто *король*.', d: 2.4 },
  { t: '!*12 вересня*', d: 3.8 },
  { t: '!*DRUID BATTLE CUP*. Пірнаємо?', d: 2.6 },
];

/* рівень рядка за префіксом + чистий текст */
const lineLevel = (t: string): { level: 'quiet' | 'base' | 'hero'; text: string } =>
  t.startsWith('~') ? { level: 'quiet', text: t.slice(1) }
  : t.startsWith('!') ? { level: 'hero', text: t.slice(1) }
  : { level: 'base', text: t };

/* сегменти рядка: непарні частини після split('*') — акцентні */
const parseLine = (ln: string) => ln.split('*').map((text, i) => ({ text, acc: i % 2 === 1 }));

export default function BallDive({
  mode = 'follow',
  variant = 'caps',
  hitWord = 'бульк!',
  lines = DEFAULT_LINES,
  onLinesDone,
}: { mode?: 'follow' | 'dolly'; variant?: AccentVariant; hitWord?: string; lines?: NarrLine[]; onLinesDone?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const turbRef = useRef<SVGFETurbulenceElement>(null);
  const onDoneRef = useRef(onLinesDone);
  onDoneRef.current = onLinesDone;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 160, H = 285;
    cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d');
    if (!c2) return;
    const ctx: CanvasRenderingContext2D = c2;

    const SURF = 46;                    // світова Y поверхні
    const CAM0 = -(H - 64);             // старт камери: небо на весь екран, вода — смужка внизу
    const CAM_PAUSE = -140;             // рівень «зупинки»: небо 2/3 кадру, вода — нижня третина
    const T_DROP = 6.2, T_HIT = 7.4;    // мʼяч летить з верху екрана крізь усе небо
    const T_DIVE = 7.6;                 // після сплеску камера пірнає за мʼячем
    /* опускання: асимптотичне наближення + постійний мікро-дрейф —
       камера ніколи не «стає» повністю, тож зупинка не акцентована */
    const camPause = (tt: number) =>
      CAM_PAUSE + (CAM0 - CAM_PAUSE) * Math.exp(-Math.pow(tt / 2.4, 1.7)) + 1.1 * tt;
    const CAM_DIVE0 = camPause(T_DIVE);
    const BALL_Y0 = camPause(T_DROP) - 10; // старт падіння: над верхнім краєм видимого кадру
    type P = { x: number; y: number; vx: number; vy: number; r: number; life: number; splash?: boolean };
    let parts: P[] = [];
    const plankFar = Array.from({ length: 40 }, (_, i) => ({ x: (i * 41) % W, y: SURF + 12 + ((i * 61) % 760), s: 0.3 + ((i * 17) % 7) / 30 }));
    const plankNear = Array.from({ length: 26 }, (_, i) => ({ x: (i * 53) % W, y: SURF + 22 + ((i * 47) % 760), s: 0.9 + ((i * 23) % 8) / 14 }));
    /* рибки: різнокольорові, від мальків до великих, два паралакс-шари */
    const FISH_PAL = ['rgba(226,122,92,', 'rgba(238,196,88,', 'rgba(118,200,168,', 'rgba(148,168,232,', 'rgba(228,140,188,', 'rgba(186,222,240,'];
    const fishes = Array.from({ length: 12 }, (_, i) => ({
      x: (i * 47) % W,
      y: SURF + 34 + ((i * 83) % 540),
      v: (0.25 + ((i * 13) % 8) / 20) * (i % 2 ? 1 : -1),
      size: 1.5 + ((i * 7) % 10) * 0.38,          // 1.5 … ~5
      col: FISH_PAL[i % FISH_PAL.length],
      ph: i * 1.7,
      layer: i % 2,
    }));
    /* хмаринки: розкидані по висоті стартового неба, кожна зі своїм паралаксом */
    const CLOUDS = [
      { x0: 10, y: 6, f: 0.10, spd: 2.0, s: 1.0, a: 0.92 },
      { x0: 95, y: 30, f: 0.16, spd: 1.3, s: 0.72, a: 0.78 },
      { x0: 48, y: 64, f: 0.22, spd: 2.7, s: 1.25, a: 0.85 },
      { x0: 130, y: 100, f: 0.30, spd: 1.6, s: 0.58, a: 0.68 },
    ];
    let t = 0;
    let t0 = -1, tPrev = 0;             // реальний час: не залежить від фреймрейту (120Hz/фон)
    let raf = 0;
    let camY = CAM0;
    let ballW = { x: W / 2, y: -20 };   // світові координати мʼяча
    /* стрічка наративу: на екрані живуть 3-4 рядки; темп нерівномірний (d) */
    const borns: number[] = [];
    { let acc = 0; lines.forEach((ln, i) => { if (i) acc += ln.d; borns.push(acc); }); }
    let lineStart = -1;                 // момент появи першого рядка (фіксується раз)
    let offsetF = 0;                    // плавний зсув стека вгору
    let doneFired = false;              // стрічка дограла → сигнал нагору (показ кнопки)

    const surfWave = (x: number) =>
      SURF + Math.sin(x * 0.22 + t * 2.1) * 1.4 + Math.sin(x * 0.07 - t * 1.3) * 1.0 + Math.sin(x * 0.45 + t * 3.2) * 0.4;

    /* колір води від СВІТОВОЇ глибини: бірюза → темно-синє → майже чорне */
    function waterRGB(wy: number): [number, number, number] {
      const d = Math.max(0, wy - SURF);
      const k = Math.min(1, d / 620);
      const kk = k * k;
      return [Math.round(42 - 40 * kk), Math.round(150 - 138 * kk), Math.round(188 - 168 * kk)];
    }

    function frame(now: number) {
      if (t0 < 0) { t0 = now; tPrev = now; }
      t = (now - t0) / 1000;
      const dt = Math.min(0.1, (now - tPrev) / 1000);
      tPrev = now;
      const fk = dt * 60;               // коефіцієнт «кадрів» для frame-based величин

      /* ---- мʼяч у світі ---- */
      let show = false, ballR = 4.5;
      if (t >= T_DROP && t < T_HIT) {
        show = true;
        const p = (t - T_DROP) / (T_HIT - T_DROP);
        ballW.y = BALL_Y0 + p * (0.25 + 0.75 * p) * (SURF - BALL_Y0);
      } else if (t >= T_HIT) {
        show = true;
        const d = t - T_HIT;
        /* швидкий вхід → постійне повільне тонення (світ нескінченний) */
        ballW.y = SURF + 46 * (1 - Math.exp(-d / 1.6)) + d * 13;
        ballW.x = W / 2 + Math.sin(d * 0.9) * 5;
        ballR = 4.5 - Math.min(1.6, d * 0.12);
      }

      /* ---- камера (аналітична — стійка до фризів/тротлінгу) ----
         мʼяке опускання з дрейфом (мʼяч летить) → занурення В ТЕМПІ МʼЯЧА */
      if (t < T_DIVE) {
        camY = camPause(t);
      } else if (mode === 'follow') {
        /* smoothstep-бленд до жорсткої зчіпки з мʼячем: на виході переходу
           швидкість камери = швидкості мʼяча, далі рух точно однаковий */
        const e = Math.min(1, (t - T_DIVE) / 2.2);
        const E = e * e * (3 - 2 * e);
        camY = CAM_DIVE0 + (ballW.y - H * 0.34 - CAM_DIVE0) * E;
      } else {
        /* рівний dolly: плавний розгін до 13 px/s — асимптотичний темп мʼяча */
        const td = t - T_DIVE;
        camY = CAM_DIVE0 + 13 * (td - 0.6 * (1 - Math.exp(-td / 0.6)));
      }
      const darkness = Math.min(0.85, Math.max(0, camY) / 330); // чим нижче — тим темніше
      /* далеке небо рухається повільніше за світ, поки камера над водою */
      const par = (f: number) => (camY < 0 ? camY * f : camY);

      /* ---- фон: небо (якщо в кадрі) + вода зі світовим градієнтом ---- */
      const horizonS = SURF - camY;                       // екранна Y горизонту
      for (let y = 0; y < H; y += 1) {
        const wy = y + camY;
        if (wy < SURF - 4) {
          const k = Math.min(1, Math.max(0, (wy - CAM0) / (SURF - CAM0)));
          const kk = Math.pow(k, 1.4);
          ctx.fillStyle = `rgb(${Math.round(96 + 104 * kk)},${Math.round(170 + 66 * kk)},${Math.round(215 + 33 * kk)})`;
        } else {
          const [r, g, b] = waterRGB(wy);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.fillRect(0, y, W, 1);
      }

      /* ---- небесні елементи (тільки поки небо в кадрі) ---- */
      if (horizonS > -6) {
        /* хмаринки: кілька шарів, свій темп і паралакс у кожної */
        for (const c of CLOUDS) {
          const cxx = ((t * c.spd + c.x0) % (W + 70)) - 35;
          const cy = c.y - par(c.f);
          if (cy > horizonS - 4) continue;
          ctx.fillStyle = `rgba(255,255,255,${c.a})`;
          ctx.fillRect(Math.round(cxx), Math.round(cy), Math.round(26 * c.s), 4);
          ctx.fillRect(Math.round(cxx + 5 * c.s), Math.round(cy) - 3, Math.round(14 * c.s), 3);
          ctx.fillRect(Math.round(cxx + 4 * c.s), Math.round(cy) + 4, Math.round(18 * c.s), 3);
        }
        /* птахи: троє, махають крилами */
        const birdY = -par(0.3);
        ctx.fillStyle = 'rgba(60,84,96,0.55)';
        for (const [bx0, by0, phb] of [[100, 16, 0], [116, 20, 1.5], [88, 24, 3.1]]) {
          const bx = Math.round(bx0 + Math.sin(t * 0.7 + phb) * 8);
          const by = Math.round(by0 + birdY + Math.sin(t * 0.9 + phb) * 1.5);
          const up = Math.sin(t * 7 + phb) > 0 ? -1 : 0;
          ctx.fillRect(bx - 2, by + up, 2, 1);
          ctx.fillRect(bx, by, 1, 1);
          ctx.fillRect(bx + 1, by + up, 2, 1);
        }

        /* ---- горизонт: делікатна кромка ---- */
        for (let x = 0; x < W; x += 1) {
          const sy = surfWave(x) - camY;
          ctx.fillStyle = '#c8e6f4';
          ctx.fillRect(x, Math.round(horizonS) - 4, 1, Math.max(0, Math.round(sy) - (Math.round(horizonS) - 4)));
          ctx.fillStyle = 'rgba(246,253,255,0.9)'; ctx.fillRect(x, Math.round(sy), 1, 1);
          ctx.fillStyle = 'rgba(196,236,250,0.6)'; ctx.fillRect(x, Math.round(sy) + 1, 1, 1);
          ctx.fillStyle = 'rgba(140,210,232,0.35)'; ctx.fillRect(x, Math.round(sy) + 2, 1, 2);
          ctx.fillStyle = 'rgba(110,190,215,0.18)'; ctx.fillRect(x, Math.round(sy) + 4, 1, 3);
          if (Math.sin(x * 1.7 + t * 2.2) * Math.sin(x * 0.31 - t * 1.1) > 0.985) {
            ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x, Math.round(sy) - 1, 1, 1);
          }
        }
      }

      /* ---- god-rays від поверхні (світові, виходять із кадру з камерою) ---- */
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin(t * 0.4 + i * 1.9) * 12;
        const x0 = 16 + i * 40 + sway;
        const breathe = 0.5 + 0.5 * Math.sin(t * 0.65 + i * 2.2);
        const wBase = 3 + breathe * 4;
        for (let wy = SURF + 4; wy < SURF + 220; wy += 2) {
          const ys = wy - camY;
          if (ys < -2 || ys > H) continue;
          const prog = (wy - SURF) / 220;
          const a = (0.075 - i * 0.008) * breathe * (1 - prog) * (1 - prog);
          if (a <= 0.004) continue;
          const wRay = wBase + prog * 7;
          const xx = x0 + (wy - SURF) * (0.14 + i * 0.02);
          ctx.fillStyle = `rgba(215,244,255,${a})`;
          ctx.fillRect(Math.round(xx), Math.round(ys), Math.round(wRay), 2);
        }
      }
      /* каустична сітка близько до поверхні (світова) */
      for (let gy = 0; gy < 4; gy++) {
        const bandW = SURF + 14 + gy * 26;
        const ys0 = bandW - camY;
        if (ys0 < -8 || ys0 > H + 8) continue;
        const fade = 1 - gy * 0.22;
        for (let x = 0; x < W; x += 4) {
          const n = Math.sin(x * 0.32 + t * 1.5 + gy) * Math.sin(x * 0.13 - t * 0.9 + gy * 3) + Math.sin(x * 0.07 + t * 0.5);
          if (n > 1.05) {
            const yy = ys0 + Math.sin(x * 0.09 + t * 1.1 + gy) * 6;
            ctx.fillStyle = `rgba(205,242,255,${0.12 * fade})`;
            ctx.fillRect(x, Math.round(yy), 4, 2);
          }
        }
      }
      /* планктон: 2 паралакс-шари у світі */
      ctx.fillStyle = 'rgba(200,232,246,0.16)';
      for (const p of plankFar) { const ys = p.y - camY * 0.85; if (ys > -2 && ys < H) ctx.fillRect(Math.round((p.x + t * 2 * p.s) % W), Math.round(ys + Math.sin(t * 0.5 + p.x) * 1.5), 1, 1); }
      ctx.fillStyle = 'rgba(220,245,255,0.30)';
      for (const p of plankNear) { const ys = p.y - camY; if (ys > -2 && ys < H) ctx.fillRect(Math.round((p.x + t * 5 * p.s) % W), Math.round(ys + Math.sin(t * 0.8 + p.x) * 2.5), 1, 1); }

      /* ---- рибки: пливуть собі, сахаються від мʼяча ---- */
      for (const f of fishes) {
        const flee = show ? Math.max(0, 1 - Math.hypot(f.x - ballW.x, f.y - ballW.y) / 30) : 0;
        if (flee > 0) {
          const dx = Math.sign(f.x - ballW.x || 1);
          f.x += dx * flee * 1.4 * fk;
          f.y += Math.sign(f.y - ballW.y || 1) * flee * 0.7 * fk;
          f.v = Math.max(-1.2, Math.min(1.2, f.v + dx * flee * 0.02 * fk));
        }
        f.x += f.v * fk;
        if (f.x < -8) f.x += W + 16; else if (f.x > W + 8) f.x -= W + 16;
        const fy = f.y + Math.sin(t * 1.3 + f.ph) * 2;
        const ys = fy - camY * (f.layer ? 1 : 0.85);
        if (ys < -6 || ys > H + 6 || fy < SURF + 10) continue;
        const dir = f.v >= 0 ? 1 : -1;
        const bh = Math.max(2, Math.round(f.size * 0.8));      // висота тіла
        const a = f.layer ? 0.8 : 0.5;
        ctx.fillStyle = f.col + a + ')';
        ctx.fillRect(Math.round(f.x - f.size), Math.round(ys - bh / 2), Math.round(f.size * 2), bh);
        const tl = Math.max(2, Math.round(f.size * 0.9));      // хвіст-трикутник
        for (let q = 0; q < tl; q++) {
          ctx.fillRect(Math.round(f.x - dir * (f.size + 1 + q)), Math.round(ys - (q + 1) / 2), 1, q + 1);
        }
        if (f.size > 3) {                                       // око + плавник у великих
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(Math.round(f.x + dir * (f.size - 1)), Math.round(ys - 1), 1, 1);
          ctx.fillStyle = f.col + a * 0.7 + ')';
          ctx.fillRect(Math.round(f.x - 1), Math.round(ys - bh / 2 - 1), 2, 1);
        }
      }
      /* висхідні бульбашки в глибині: підкреслюють рух камери вниз */
      if (camY > 20 && Math.random() < 0.10 * fk) {
        parts.push({ x: Math.random() * W, y: camY + H + 4, vx: 0, vy: -(0.35 + Math.random() * 0.4), r: 1, life: 1.4 });
      }

      /* ---- сплеск + бульбашки (світові) ---- */
      if (t >= T_HIT - 0.02 && t < T_HIT + 0.06 && parts.filter((p) => p.splash).length === 0) {
        /* віяло бризок — щедре */
        for (let i = 0; i < 30; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 3, y: SURF, vx: (Math.random() - 0.5) * 3.4, vy: -(1.4 + Math.random() * 3.2), r: Math.random() < 0.3 ? 2 : 1, life: 1, splash: true });
        /* центральний водяний стовп */
        for (let i = 0; i < 7; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 3, y: SURF + 2, vx: (Math.random() - 0.5) * 0.5, vy: -(3.4 + Math.random() * 1.6), r: 2, life: 1, splash: true });
        for (let i = 0; i < 12; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 9, y: SURF + 4, vx: (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 1.4, r: 1, life: 1 });
      }
      /* короткий білий флеш у точці удару */
      const flash = t > T_HIT && t < T_HIT + 0.14 ? 1 - (t - T_HIT) / 0.14 : 0;
      if (flash > 0 && horizonS > -6) {
        ctx.fillStyle = `rgba(255,255,255,${(flash * 0.9).toFixed(2)})`;
        ctx.fillRect(Math.round(W / 2 - 9), Math.round(surfWave(W / 2) - camY) - 2, 18, 3);
        ctx.fillStyle = `rgba(255,255,255,${(flash * 0.5).toFixed(2)})`;
        ctx.fillRect(Math.round(W / 2 - 16), Math.round(surfWave(W / 2) - camY) - 1, 32, 2);
      }
      const hitPulse = t > T_HIT && t < T_HIT + 1.3 ? (1 - (t - T_HIT) / 1.3) : 0;
      if (hitPulse > 0 && horizonS > -6) {
        for (const dir of [-1, 1]) {
          /* подвійне кільце, що розбігається */
          for (const [spd, len, aa] of [[46, 4, 0.9], [30, 3, 0.55]] as [number, number, number][]) {
            const rr = (1 - hitPulse) * spd + 5;
            const hx = W / 2 + dir * rr;
            ctx.fillStyle = `rgba(240,253,255,${(hitPulse * aa).toFixed(2)})`;
            ctx.fillRect(Math.round(hx) - 1, Math.round(surfWave(hx) - camY) - 1, len, 1);
          }
        }
      }
      /* піна на місці падіння: розпливається і тане */
      const foam = t > T_HIT && t < T_HIT + 2.4 ? 1 - (t - T_HIT) / 2.4 : 0;
      if (foam > 0 && horizonS > -6) {
        const fw = 10 + (1 - foam) * 26;
        ctx.fillStyle = `rgba(240,252,255,${0.55 * foam})`;
        for (let i = 0; i < 8; i++) {
          const fx = W / 2 + (i - 3.5) * (fw / 7) + Math.sin(i * 2.3 + t * 1.8) * 2;
          ctx.fillRect(Math.round(fx), Math.round(surfWave(fx) - camY), 2, 1);
        }
      }
      if (show && t > T_HIT && Math.random() < 0.35 * fk) {
        parts.push({ x: ballW.x + (Math.random() - 0.5) * 4, y: ballW.y - ballR, vx: (Math.random() - 0.5) * 0.25, vy: -(0.3 + Math.random() * 0.5), r: 1, life: 1 });
      }
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        if (p.splash) { p.vy += 0.1 * fk; if (p.y > surfWave(p.x) + 1 && p.vy > 0) p.life = 0; }
        if (!p.splash && p.y < surfWave(p.x) + 2) p.life = 0;
        p.x += p.vx * fk; p.y += p.vy * fk; p.life -= (p.splash ? 0.02 : 0.005) * fk;
        const ys = p.y - camY;
        if (ys > -2 && ys < H + 2) {
          ctx.fillStyle = `rgba(228,249,255,${0.8 * p.life})`;
          ctx.fillRect(Math.round(p.x), Math.round(ys), p.r, p.r);
        }
      }

      /* ---- мʼяч ---- */
      if (show) {
        const ys = ballW.y - camY;
        if (ys > -6 && ys < H + 6) {
          const deep = Math.min(1, Math.max(0, (ballW.y - SURF) / 620));
          ctx.globalAlpha = ballW.y < SURF ? 1 : Math.max(0.3, 1 - deep * 0.75);
          if (deep > 0.15) { ctx.fillStyle = `rgba(200,235,250,${0.10 * (1 - deep)})`; ctx.beginPath(); ctx.arc(ballW.x, ys, ballR + 2.5, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#f2fafd';
          ctx.beginPath(); ctx.arc(ballW.x, ys, ballR, 0, Math.PI * 2); ctx.fill();
          if (ballR > 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ballW.x - ballR * 0.4), Math.round(ys - ballR * 0.55), 2, 1); }
          ctx.globalAlpha = 1;
        }
      }

      /* ---- глобальне темніння з глибиною камери ---- */
      if (darkness > 0.01) {
        ctx.fillStyle = `rgba(1,6,18,${darkness})`;
        ctx.fillRect(0, 0, W, H);
      }

      /* ---- текстовий шар ---- */
      if (wordRef.current) {
        const w = (t - T_HIT) / 1.9;                       // слово-звук у момент удару
        if (w > 0 && w < 1) {
          wordRef.current.style.opacity = '1';
          wordRef.current.style.top = `${((SURF - camY) / H * 100 - 5).toFixed(1)}%`;
          const gone = w > 0.7 ? (w - 0.7) / 0.3 : 0;      // фінальний розліт угору
          const letters = wordRef.current.children;
          for (let i = 0; i < letters.length; i++) {
            const el = letters[i] as HTMLElement;
            const li = (t - T_HIT - i * 0.07) / 0.3;       // пружинна поява по черзі
            if (li <= 0) { el.style.opacity = '0'; continue; }
            const p = Math.min(1, li);
            const back = 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2); // easeOutBack
            const bob = p >= 1 ? Math.sin(t * 5.5 + i * 1.1) * 2.2 : 0;           // погойдування
            const rot = p >= 1 ? Math.sin(t * 6 + i * 1.4) * 5 : (1 - back) * 24;
            const y = (1 - back) * 34 + bob - gone * (26 + i * 5);
            el.style.opacity = (Math.min(1, p * 2.5) * (1 - gone)).toFixed(2);
            el.style.transform = `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${(0.6 + back * 0.4).toFixed(3)})`;
          }
        } else wordRef.current.style.opacity = '0';
      }
      if (stackRef.current) {                              // стрічка наративу під час занурення
        /* стартує, коли горизонт піднявся достатньо — текст завжди на воді */
        if (lineStart < 0 && t > T_DIVE && (SURF - camY) / H < 0.30) lineStart = t;
        const tl = lineStart < 0 ? -1 : t - lineStart;     // час стрічки
        let shown = 0;
        while (shown < lines.length && tl >= borns[shown]) shown++;
        if (!doneFired && tl > borns[lines.length - 1] + 1.4) {
          doneFired = true;
          onDoneRef.current?.();
        }
        /* «розтікання» у воді: стоп-моушн зміна зерна турбулентності (~8 к/с) */
        if (turbRef.current) turbRef.current.setAttribute('seed', String(1 + (Math.floor(t * 8) % 60)));
        const hiddenN = Math.max(0, shown - 4);
        offsetF += (hiddenN - offsetF) * Math.min(1, dt * 3.5);
        const rows = stackRef.current.children;
        /* зсув стека = сума фактичних висот прихованих рядків (рядки різних рівнів) */
        let shift = 0, rem = offsetF;
        for (let i = 0; i < rows.length && rem > 0; i++) {
          shift += Math.min(1, rem) * (rows[i] as HTMLElement).offsetHeight;
          rem -= 1;
        }
        stackRef.current.style.transform = `translateY(${(-shift).toFixed(1)}px)`;
        for (let i = 0; i < rows.length; i++) {
          const el = rows[i] as HTMLElement;
          const born = lineStart + borns[i];
          if (lineStart < 0 || t < born) { el.style.opacity = '0'; continue; }
          const ap = Math.min(1, (t - born) / 0.9);
          const dp = i + 4 < lines.length
            ? Math.max(0, Math.min(1, (t - (lineStart + borns[i + 4])) / 1.4))
            : 0;                                           // фінальні 3-4 рядки лишаються
          /* базовий моушен: спливає знизу, ледь плаває на воді, тане вгору */
          const eo = 1 - Math.pow(1 - ap, 3);
          const bob = Math.sin(t * 0.7 + i * 1.4) * 0.9;
          el.style.opacity = (ap * (1 - dp)).toFixed(2);
          el.style.transform = `translateY(${(16 * (1 - eo) - 10 * dp + bob).toFixed(1)}px)`;

          /* акценти: 5 режимів підсвітки ключових слів */
          const accs = el.getElementsByClassName('bd-acc') as HTMLCollectionOf<HTMLElement>;
          for (let k = 0; k < accs.length; k++) {
            const a = accs[k];
            if (variant === 'stamp') {
              /* жовтий удар: слово «штампується» зверху (back.out) із запізненням */
              const sp = Math.max(0, Math.min(1, (t - born - 0.35) / 0.4));
              const eb = 1 - Math.pow(1 - sp, 3);
              a.style.opacity = sp === 0 ? '0' : Math.min(1, sp * 3).toFixed(2);
              a.style.transform = `scale(${(2.2 - 1.2 * eb).toFixed(3)})`;
            } else if (variant === 'neon') {
              /* hotline: колір тече по колу + неоновий ореол + мікро-дрож */
              const hue = Math.round((t * 70 + k * 60 + i * 35) % 360);
              a.style.color = `hsl(${hue} 100% 66%)`;
              a.style.textShadow = `0 0 6px hsl(${hue} 100% 55% / 0.9), 0 0 16px hsl(${hue} 100% 50% / 0.5)`;
              a.style.transform = `translate(${((Math.random() - 0.5) * 1.2).toFixed(2)}px, ${((Math.random() - 0.5) * 1.2).toFixed(2)}px)`;
            } else if (variant === 'glitch') {
              /* rgb-спліт: короткий глітч-сплеск раз на ~1.8с, у кожного слова своя фаза */
              const cyc = (t * 0.55 + i * 0.37 + k * 0.21) % 1;
              if (cyc < 0.09) {
                const g = Math.sin((cyc / 0.09) * Math.PI);
                a.style.textShadow = `${(2.5 * g).toFixed(1)}px 0 #ff2ba6, ${(-2.5 * g).toFixed(1)}px 0 #00e5ff`;
                a.style.transform = `translateX(${((Math.random() - 0.5) * 3 * g).toFixed(1)}px)`;
              } else { a.style.textShadow = 'none'; a.style.transform = 'none'; }
            } else if (variant === 'invert') {
              /* плашка: жовтий блок замальовує слово wipe-ом зліва направо */
              const sp = Math.max(0, Math.min(1, (t - born - 0.35) / 0.35));
              a.style.backgroundSize = `${(sp * 100).toFixed(0)}% 100%`;
              a.style.color = sp > 0.5 ? '#16110d' : 'rgba(255,255,255,0.97)';
            }
            /* caps: статичний — капс + масштаб, задано стилями в JSX */
          }
        }
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, variant, lines]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={ref} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        imageRendering: 'pixelated', display: 'block',
      }} />
      <div ref={wordRef} style={{
        position: 'absolute', left: '50%', top: '11%', transform: 'translate(-50%,-100%)',
        opacity: 0, pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: NARR_FONT, fontSize: 'clamp(18px, 6vw, 30px)',
        textTransform: 'uppercase', letterSpacing: '0.02em', color: '#ffffff',
        textShadow: '3px 3px 0 rgba(8,28,42,0.55)',
      }}>
        {hitWord.split('').map((ch, i) => (
          <span key={i} style={{ display: 'inline-block', opacity: 0 }}>{ch}</span>
        ))}
      </div>
      {/* фільтр «розтікання у воді»: легкий displacement, зерно міняє rAF */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="bdwater" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence ref={turbRef} type="fractalNoise" baseFrequency="0.008 0.045" numOctaves="1" seed="1" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div ref={stackRef} style={{
        position: 'absolute', left: 0, right: 0, top: '32%', padding: '0 14px',
        pointerEvents: 'none', textAlign: 'center', filter: 'url(#bdwater)',
      }}>
        {lines.map((ln, i) => {
          const { level, text } = lineLevel(ln.t);
          return (
            <div key={i} style={{
              opacity: 0, display: 'flex', flexWrap: 'wrap',
              alignItems: 'center', justifyContent: 'center', columnGap: 0,
              fontFamily: NARR_FONT, lineHeight: 1.8,
              minHeight: level === 'hero' ? 64 : level === 'quiet' ? 42 : 52,
              fontSize: level === 'hero' ? 17 : level === 'quiet' ? 10 : 12,
              color: level === 'quiet' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.97)',
              textShadow: '0 2px 10px rgba(0,0,0,0.75)',
            }}>
              {parseLine(text).map((seg, j) => seg.acc ? (
                <span key={j} className="bd-acc" style={{
                  display: 'inline-block', whiteSpace: 'pre',
                  ...(variant === 'caps' && { textTransform: 'uppercase' as const, fontSize: '1.25em', color: '#ffffff' }),
                  ...(variant === 'stamp' && { textTransform: 'uppercase' as const, fontSize: '1.2em', color: '#ffc619', opacity: 0 }),
                  ...(variant === 'neon' && { fontSize: '1.1em' }),
                  ...(variant === 'glitch' && { textTransform: 'uppercase' as const, fontSize: '1.1em', color: '#ffffff' }),
                  ...(variant === 'invert' && {
                    fontSize: '1.05em', padding: '3px 5px',
                    backgroundImage: 'linear-gradient(#ffc619,#ffc619)',
                    backgroundRepeat: 'no-repeat', backgroundSize: '0% 100%',
                  }),
                }}>{seg.text}</span>
              ) : (
                <span key={j} style={{ whiteSpace: 'pre' }}>{seg.text}</span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

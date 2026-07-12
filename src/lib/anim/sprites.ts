/* Процедурні Memphis-спрайти для canvas-анімацій кіоску.
   Підхід remotion-towers (tower6/sprites.ts): кожен спрайт малюється вектором
   прямо в контекст у власній системі координат, анімовані параметри (замах,
   сплющення) передаються ззовні. Стиль — інк-контури, плоскі заливки,
   hard-тіні, як у Memphis-мові проєкту. */

export type Palette = {
  ink: string; pink: string; cyan: string; yellow: string;
  coral: string; purple: string; lime: string; blue: string;
};

const FALLBACK: Palette = {
  ink: '#16110D', pink: '#FF2E88', cyan: '#00CFC1', yellow: '#FFC619',
  coral: '#FF5A36', purple: '#8A45FF', lime: '#A6E22E', blue: '#2D4BFF',
};

/** Палітра з CSS-змінних елемента (тема підхоплюється на монтуванні). */
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    ink: v('--line', FALLBACK.ink), pink: v('--pink', FALLBACK.pink),
    cyan: v('--cyan', FALLBACK.cyan), yellow: v('--yellow', FALLBACK.yellow),
    coral: v('--coral', FALLBACK.coral), purple: v('--purple', FALLBACK.purple),
    lime: v('--lime', FALLBACK.lime), blue: v('--blue', FALLBACK.blue),
  };
}

/** Детермінований PRNG (mulberry32) — відтворювана «випадковість», як у towers. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* маленький roundRect без залежності від ctx.roundRect (старі webview) */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** М'яч: брендовий градієнт + інк-контур + шов; squash 0..1 — сплющення. */
export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, rot: number, ink: string, squash = 0,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + squash * .28, 1 - squash * .34);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .15, 0, 0, r);
  g.addColorStop(0, '#fff'); g.addColorStop(.55, '#FFE34D'); g.addColorStop(1, '#FFC619');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2, r * .2); ctx.strokeStyle = ink; ctx.stroke();
  ctx.beginPath(); ctx.arc(r * .55, 0, r * .78, Math.PI * .72, Math.PI * 1.28); // шов
  ctx.lineWidth = Math.max(1.4, r * .12); ctx.strokeStyle = 'rgba(13,15,13,.25)'; ctx.stroke();
  ctx.restore();
}

/** Тінь на «столі»: еліпс, що тане з висотою польоту. */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, alpha: number, ink: string,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * .38, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Ракетка згори (лезо + ручка до +y). Малюється двічі: hard-тінь, потім тіло. */
export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number, scale: number,
  face: string, ink: string,
) {
  const blade = () => { ctx.beginPath(); ctx.ellipse(0, 0, 17, 21, 0, 0, Math.PI * 2); };
  const handle = () => { ctx.beginPath(); rr(ctx, -5.5, 14, 11, 26, 5); };
  const pass = (dx: number, dy: number, silhouette: boolean) => {
    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    if (silhouette) {
      ctx.fillStyle = ink;
      handle(); ctx.fill(); blade(); ctx.fill();
    } else {
      ctx.lineWidth = 3; ctx.strokeStyle = ink;
      ctx.fillStyle = '#E8B34C'; handle(); ctx.fill(); ctx.stroke(); // деревʼяна ручка
      ctx.fillStyle = face; blade(); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = .35; ctx.fillStyle = '#fff'; // блік гуми
      ctx.beginPath(); ctx.ellipse(-5, -7, 5.5, 8, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };
  pass(4, 4, true); // hard-тінь Memphis
  pass(0, 0, false);
}

/** Стіл згори: плита з hard-тінню, крайова + центральна розмітка, сітка зі
    стовпчиками. Розмітка — завжди кремова (як біла на справжньому столі). */
export function drawTable(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  fill: string, ink: string, s = 1,
) {
  const r = 14;
  ctx.save();
  ctx.fillStyle = ink; // hard-тінь Memphis
  ctx.beginPath(); rr(ctx, x + 5, y + 5, w, h, r); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); rr(ctx, x, y, w, h, r); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ink;
  ctx.beginPath(); rr(ctx, x, y, w, h, r); ctx.stroke();
  ctx.strokeStyle = '#FBF1DD'; ctx.lineWidth = 2.5; // крайова розмітка
  ctx.beginPath(); rr(ctx, x + 7, y + 7, w - 14, h - 14, 8); ctx.stroke();
  ctx.globalAlpha = .8; ctx.lineWidth = 2; // центральна лінія (для пар)
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 8); ctx.lineTo(x + w / 2, y + h - 8); ctx.stroke();
  ctx.globalAlpha = 1;
  const ny = y + h / 2; // сітка: пунктир поперек + стовпчики по боках
  ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.setLineDash([7 * s, 5 * s]);
  ctx.beginPath(); ctx.moveTo(x - 5, ny); ctx.lineTo(x + w + 5, ny); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.arc(x - 5, ny, 4.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w + 5, ny, 4.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Примарний гравець: купол + хвилястий поділ + очі, що стежать за м'ячем
    (eyeDx). Напівпрозорий — він же привид. lean — нахил корпуса, рад. */
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, lean: number, s: number,
  ink: string, eyeDx = 0, alpha = .85,
) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(lean); ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(0, -6, 16, Math.PI, 0); // купол
  ctx.lineTo(16, 10);
  for (let i = 0; i < 4; i++) { // хвилястий поділ
    ctx.quadraticCurveTo(16 - i * 8 - 4, 18, 16 - (i + 1) * 8, 10);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = ink;
  const ex = Math.max(-3, Math.min(3, eyeDx));
  ctx.beginPath(); ctx.arc(-5 + ex, -8, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5 + ex, -8, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Пунктирне кільце відскоку: t 0..1 — розліт і згасання; s — масштаб сцени. */
export function drawRipple(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, t: number, ink: string, s = 1,
) {
  ctx.save();
  ctx.globalAlpha = (1 - t) * .8;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5 * s;
  ctx.setLineDash([6 * s, 6 * s]);
  ctx.beginPath();
  ctx.ellipse(x, y, (6 + t * 30) * s, (6 + t * 30) * s * .42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Конфеті-фігурка: 0 — квадрат, 1 — трикутник, 2 — кружок. */
export function drawConfettiPiece(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rot: number, size: number,
  color: string, shape: number, alpha: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (shape === 0) ctx.fillRect(-size / 2, -size / 2, size, size);
  else if (shape === 1) {
    ctx.beginPath();
    ctx.moveTo(0, -size * .6); ctx.lineTo(size * .6, size * .5); ctx.lineTo(-size * .6, size * .5);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, size * .5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

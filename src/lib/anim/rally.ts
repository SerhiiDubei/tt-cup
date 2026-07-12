/* Математика ралі для canvas-сцен кіоску (QueueIdle).
   Патерн towers: чисті функції від параметрів — жодного React/DOM усередині.
   Сцени самі малюють спрайти й тримають rAF-петлю; тут лише траєкторії
   («удар» = квадратичне безьє у площині + фейкова висота) і крок ефектів. */

export type RallyTuning = {
  shotMs: [number, number];    // тривалість звичайного удару
  smashMs: [number, number];   // тривалість смешу
  smashEvery: [number, number];// смеш раз на стільки ударів
  arc: [number, number];       // висота дуги, частка характерного розміру сцени
  spin: number;                // бокове кручення (кривина шляху)
};

export type Shot = {
  x0: number; y0: number; cx: number; cy: number; x1: number; y1: number;
  /** Фаза відскоку від стола; від'ємна — чиста дуга без відскоку. */
  bT: number;
  arc1: number; arc2: number; dur: number; smash: boolean;
};

export type Pt = { x: number; y: number };

export const between = (rnd: () => number, r: [number, number]) =>
  r[0] + rnd() * (r[1] - r[0]);

/** Лічильник «час смешу?» — інкапсулює кадансу smashEvery. */
export function makeSmashCadence(rnd: () => number, every: [number, number]) {
  let count = 0;
  let next = Math.round(between(rnd, every));
  return (): boolean => {
    count += 1;
    if (count < next) return false;
    count = 0;
    next = Math.round(between(rnd, every));
    return true;
  };
}

/** Новий удар from → to. len — характерний розмір сцени (база висоти дуг);
    bounce — з відскоком від стола (true у виду згори) чи чиста дуга. */
export function makeShot(opts: {
  rnd: () => number; tuning: RallyTuning;
  from: Pt; to: Pt; len: number; smash: boolean; bounce: boolean;
}): Shot {
  const { rnd, tuning: t, from, to, len, smash, bounce } = opts;
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const side = (rnd() - .5) * 2 * t.spin * len * .4; // знос перпендикулярно польоту
  return {
    x0: from.x, y0: from.y, x1: to.x, y1: to.y,
    cx: (from.x + to.x) / 2 + (-dy / d) * side,
    cy: (from.y + to.y) / 2 + (dx / d) * side,
    bT: bounce ? .52 + rnd() * .16 : -1,
    arc1: len * between(rnd, t.arc) * (smash ? .3 : 1),
    arc2: len * between(rnd, t.arc) * .38 * (smash ? .5 : 1),
    dur: smash ? between(rnd, t.smashMs) : between(rnd, t.shotMs),
    smash,
  };
}

/* положення у площині «стола» — квадратичне безьє */
export const shotX = (s: Shot, u: number) =>
  (1 - u) * (1 - u) * s.x0 + 2 * (1 - u) * u * s.cx + u * u * s.x1;
export const shotY = (s: Shot, u: number) =>
  (1 - u) * (1 - u) * s.y0 + 2 * (1 - u) * u * s.cy + u * u * s.y1;

/** Висота: дві параболи зі стиком у точці відскоку або одна чиста дуга. */
export function shotZ(s: Shot, u: number, contactZ: number): number {
  if (s.bT < 0) return contactZ + Math.sin(Math.PI * u) * s.arc1;
  if (u < s.bT) {
    const v = u / s.bT;
    return contactZ * (1 - v) + Math.sin(Math.PI * v) * s.arc1;
  }
  const v = (u - s.bT) / (1 - s.bT);
  return contactZ * v + Math.sin(Math.PI * v) * s.arc2;
}

/* ---------- ефекти: трейл, кільця відскоку, конфеті ---------- */

export type Fx = {
  trail: { x: number; y: number; a: number }[];
  ripples: { x: number; y: number; t: number }[];
  confetti: {
    x: number; y: number; vx: number; vy: number;
    rot: number; vr: number; c: string; shape: number; life: number;
  }[];
};

export const makeFx = (): Fx => ({ trail: [], ripples: [], confetti: [] });

export function pushTrail(fx: Fx, x: number, y: number) {
  fx.trail.push({ x, y, a: .9 });
}

export function spawnConfetti(
  fx: Fx, rnd: () => number, x: number, y: number, colors: string[], s = 1,
) {
  for (let i = 0; i < 11; i++) fx.confetti.push({
    x, y, vx: (rnd() - .5) * 280 * s, vy: (-rnd() * 190 - 50) * s,
    rot: rnd() * Math.PI, vr: (rnd() - .5) * 12,
    c: colors[i % colors.length], shape: i % 3, life: 1,
  });
}

/** Один крок усіх ефектів; dt у мс. */
export function stepFx(fx: Fx, dt: number) {
  for (const p of fx.trail) p.a *= Math.exp(-dt / 220);
  while (fx.trail.length && (fx.trail[0].a < .05 || fx.trail.length > 18)) fx.trail.shift();
  for (const r of fx.ripples) r.t += dt / 480;
  while (fx.ripples.length && fx.ripples[0].t >= 1) fx.ripples.shift();
  for (const c of fx.confetti) {
    c.x += c.vx * dt / 1000; c.y += c.vy * dt / 1000;
    c.vy += 520 * dt / 1000; c.rot += c.vr * dt / 1000; c.life -= dt / 680;
  }
  while (fx.confetti.length && fx.confetti[0].life <= 0) fx.confetti.shift();
}

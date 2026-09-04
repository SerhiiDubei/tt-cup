/* Математика ралі для canvas-сцен кіоску (QueueIdle).
   Патерн towers: чисті функції від параметрів — жодного React/DOM усередині.

   ФІЗИКА (D-057). Раніше висота була синусоїдою, а мить відскоку — рандомом;
   м'яч через це «плавав». Тепер це справжня балістика:
     · висота — парабола вільного падіння (z = z₀ + v₀t − ½gt²), тому м'яч
       довше висить біля вершини і різкіше падає, як у житті;
     · мить відскоку НЕ задається — вона виводиться з висоти дуги і гравітації;
     · відскік втрачає енергію за реституцією (пінг-понговий м'яч: з 30 см
       підстрибує на ~23 см → e ≈ 0.88), тому друга дуга завжди нижча за першу;
     · горизонталь гальмує повітрям (експонента) і додатково втрачає ~14%
       швидкості об стіл — політ «розсипається» до кінця, а не тягне рівно;
     · топспін на смеші = підвищена ефективна гравітація: плаский швидкий
       політ із різким пірнанням униз.
   Тривалість удару (dur) лишається хореографією — фізичний ПРОФІЛЬ просто
   програється за цей час, тож темп ралі керується як раніше. */

export type RallyTuning = {
  shotMs: [number, number];    // тривалість звичайного удару
  smashMs: [number, number];   // тривалість смешу
  smashEvery: [number, number];// смеш раз на стільки ударів
  arc: [number, number];       // висота дуги, частка характерного розміру сцени
  spin: number;                // бокове кручення (кривина шляху)
};

/**
 * ЕФЕКТИВНА реституція в ралі. Паспортна для м'яча об стіл — 0.88
 * (ITTF: падіння з 30 см → підскок 23 см), але то ВЕРТИКАЛЬНЕ падіння.
 * У грі удар косий і з топспіном: обертання «вгризається» в стіл, частина
 * енергії йде в проковзування, тож м'яч виходить помітно пласкіше.
 * 0.62 → друга дуга ≈ 38% від першої, як і має бути у драйвовому обміні.
 */
const RESTITUTION = 0.62;
/** Втрата горизонтальної швидкості на відскоку (тертя об стіл). */
const BOUNCE_FRICTION = 0.86;
/** Опір повітря: частка швидкості, з'їдена за ВЕСЬ політ (не за одиницю часу). */
const AIR_DRAG = 0.45;
/** Топспін смешу: у скільки разів «важчає» м'яч на спуску. */
const TOPSPIN_G = 1.6;

export type Shot = {
  x0: number; y0: number; cx: number; cy: number; x1: number; y1: number;
  /** Фаза відскоку від стола (0..1); від'ємна — чиста дуга без відскоку. */
  bT: number;
  arc1: number; arc2: number; dur: number; smash: boolean;
  /* --- фізичний профіль (нормалізований час, g=1) --- */
  g: number;        // ефективна гравітація (топспін підвищує)
  h0: number;       // висота контакту з ракеткою
  vz0: number;      // стартова вертикальна швидкість
  vz1: number;      // вертикальна швидкість одразу після відскоку
  tb: number;       // час до відскоку
  t2: number;       // час від відскоку до прийому
  tn: number;       // повний «природний» час польоту
  impact: number;   // швидкість удару об стіл (для squash)
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
    bounce — з відскоком від стола (true у виду згори) чи чиста дуга;
    contactZ — висота м'яча в момент удару ракеткою. */
export function makeShot(opts: {
  rnd: () => number; tuning: RallyTuning;
  from: Pt; to: Pt; len: number; smash: boolean; bounce: boolean;
  contactZ?: number;
}): Shot {
  const { rnd, tuning: t, from, to, len, smash, bounce } = opts;
  const h0 = opts.contactZ ?? 0;
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const side = (rnd() - .5) * 2 * t.spin * len * .4; // знос перпендикулярно польоту

  // Висота дуги над точкою удару. Смеш — навмисне пласкіший.
  const arc1 = len * between(rnd, t.arc) * (smash ? .34 : 1);
  const g = smash ? TOPSPIN_G : 1;

  // Балістика до столу: злітаємо з h0, падаємо в нуль.
  const vz0 = Math.sqrt(2 * g * arc1);
  const impact = Math.sqrt(vz0 * vz0 + 2 * g * h0); // швидкість зустрічі зі столом
  const tb = (vz0 + impact) / g;

  // Відскік: енергія падає за реституцією → друга дуга сама виходить нижчою.
  const vz1 = RESTITUTION * impact;
  const arc2 = (vz1 * vz1) / (2 * g);
  // Час до прийому: ловимо м'яч на СПУСКУ на висоті h0; якщо енергії забракло —
  // приймаємо на вершині (низько над столом, теж життєво).
  const disc = vz1 * vz1 - 2 * g * h0;
  const t2 = disc >= 0 ? (vz1 + Math.sqrt(disc)) / g : vz1 / g;

  const tn = bounce ? tb + t2 : 0;
  return {
    x0: from.x, y0: from.y, x1: to.x, y1: to.y,
    cx: (from.x + to.x) / 2 + (-dy / d) * side,
    cy: (from.y + to.y) / 2 + (dx / d) * side,
    bT: bounce ? tb / tn : -1,
    arc1, arc2,
    dur: smash ? between(rnd, t.smashMs) : between(rnd, t.shotMs),
    smash,
    g, h0, vz0, vz1, tb, t2, tn: tn || 1, impact,
  };
}

/* ---------- горизонталь: драг у повітрі + гальмо об стіл ---------- */

/** Пройдена відстань за НОРМАЛІЗОВАНИЙ час (0..1 = весь політ) з експон. драгом. */
const travel = (v0: number, dt: number) =>
  AIR_DRAG > 1e-6 ? v0 * (1 - Math.exp(-AIR_DRAG * dt)) / AIR_DRAG : v0 * dt;

/**
 * Частка шляху, пройдена до моменту u (0..1) — НЕ лінійна:
 * м'яч летить швидко на початку, гальмує повітрям і різко втрачає
 * швидкість на відскоку. Саме це читається оком як «фізика».
 * Час нормалізований на повний політ, щоб драг не залежав від масштабу сцени.
 */
export function shotProgress(s: Shot, u: number): number {
  const uu = Math.max(0, Math.min(1, u));
  if (s.bT < 0) { // чиста дуга без відскоку — лише повітряний драг
    const full = travel(1, 1) || 1;
    return travel(1, uu) / full;
  }
  const d1 = travel(1, s.bT);
  const v1 = Math.exp(-AIR_DRAG * s.bT) * BOUNCE_FRICTION; // швидкість після удару об стіл
  const d2 = travel(v1, 1 - s.bT);
  const total = d1 + d2 || 1;
  return uu <= s.bT
    ? travel(1, uu) / total
    : (d1 + travel(v1, uu - s.bT)) / total;
}

/* положення у площині «стола» — квадратичне безьє по ФІЗИЧНОМУ прогресу */
const bez = (a: number, b: number, c: number, p: number) =>
  (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;

export const shotX = (s: Shot, u: number) => bez(s.x0, s.cx, s.x1, shotProgress(s, u));
export const shotY = (s: Shot, u: number) => bez(s.y0, s.cy, s.y1, shotProgress(s, u));

/** Висота: вільне падіння до столу, після відскоку — нова парабола. */
export function shotZ(s: Shot, u: number, contactZ?: number): number {
  const h0 = contactZ ?? s.h0;
  if (s.bT < 0) { // чиста дуга: симетричний підліт-спуск
    const t = u * 2 * Math.sqrt(2 * s.arc1 / s.g || 1);
    const T = 2 * Math.sqrt(2 * s.arc1 / s.g || 1);
    const vz = s.g * T / 2;
    return Math.max(0, h0 + vz * t - .5 * s.g * t * t);
  }
  const t = u * s.tn;
  if (t < s.tb) return Math.max(0, h0 + s.vz0 * t - .5 * s.g * t * t);
  const t2 = t - s.tb;
  return Math.max(0, s.vz1 * t2 - .5 * s.g * t2 * t2);
}

/** Сила удару об стіл 0..~1.4 — для squash&stretch у сцені. */
export const shotImpact = (s: Shot) => s.impact / Math.max(1e-6, Math.sqrt(2 * s.g * s.arc1));

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

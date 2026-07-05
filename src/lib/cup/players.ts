import { AVATAR_OPTIONS, type Traits } from '@/lib/avatar';
import { STYLES } from '@/config';
import type { CupPlayer } from '@/lib/cup/types';

/** A pool of realistic + fun Ukrainian first names and nicknames, mixed genders. */
export const UA_NAMES: string[] = [
  'Олег',
  'Маркіян',
  'Соломія',
  'Тарас Вихор',
  'Іванка',
  'Богдан Спін',
  'Назар',
  'Олеся',
  'Дмитро',
  'Катря',
  'Остап',
  'Ярина',
  'Андрій Блискавка',
  'Зоряна',
  'Володимир',
  'Леся',
  'Степан',
  'Мирослава',
  'Юрко',
  'Дарина',
  'Роман Щит',
  'Оксана',
  'Петро',
  'Галя',
  'Святослав',
  'Уляна',
  'Максим Топ',
  'Христина',
  'Василько',
  'Надія',
  'Гриць',
  'Віра Куля',
  'Левко',
  'Аліна',
  'Тимко',
  'Орися',
  'Денис',
  'Богдана',
  'Ілько Ракета',
  'Соня',
  'Михайло',
  'Лілія',
  'Артем Смеш',
  'Квітка',
  'Захар',
  'Мотря',
];

/** Pick a random option id from each AVATAR_OPTIONS group using the injected rand(). */
export function randomTraits(rand: () => number): Traits {
  const pick = (group: keyof Traits): string => {
    const opts = AVATAR_OPTIONS[group];
    return opts[Math.floor(rand() * opts.length)].id;
  };
  return {
    gender: pick('gender'),
    skin: pick('skin'),
    hair: pick('hair'),
    hairColor: pick('hairColor'),
    outfit: pick('outfit'),
    accessory: pick('accessory'),
  };
}

/** Pick a random play-style from STYLES using the injected rand(). */
export function randomStyle(rand: () => number): string {
  return STYLES[Math.floor(rand() * STYLES.length)];
}

/** Build a single player with random traits/style. */
export function makePlayer(name: string, rand: () => number, id: string): CupPlayer {
  return {
    id,
    name,
    traits: randomTraits(rand),
    style: randomStyle(rand),
  };
}

/** Generate `count` players with distinct display names, ids 'p1'..'pN'. */
export function randomPlayers(count: number, rand: () => number): CupPlayer[] {
  const names = shuffle(UA_NAMES, rand);
  const players: CupPlayer[] = [];
  for (let i = 0; i < count; i++) {
    let name = names[i % names.length];
    // If we cycle past the pool, suffix to keep names distinct.
    if (i >= names.length) {
      const cycle = Math.floor(i / names.length) + 1;
      name = `${name} ${cycle}`;
    }
    players.push(makePlayer(name, rand, `p${i + 1}`));
  }
  return players;
}

/** Pure Fisher-Yates shuffle returning a new array. */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Small seeded PRNG (mulberry32) returning a function that yields [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

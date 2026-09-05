// Спільна логіка ліги DRUID BATTLE CUP (флоу /join → /ya/[token]).

/** Лінк банки monobank; задається в env, поки порожній — імітація оплати. */
export const BANKA_URL = process.env.NEXT_PUBLIC_BANKA_URL || '';

/** Поки банки нема — тестова ІМІТАЦІЯ оплати (D-035): флоу проходиться до кінця. */
export const MOCK_PAY = !BANKA_URL;

/** Куди слати скріншот переказу (D-036: банка + скріншот у Telegram).
 *  Постав юзернейм бота/орга: 'https://t.me/xxxxx'. Порожньо = текст без лінка. */
export const TG_CONFIRM_URL = process.env.NEXT_PUBLIC_TG_CONFIRM_URL || '';

/** Ключові дати (D-036): ліга 21 день, реєстрація до жеребкування. */
export const DRAW_DATE = '2026-09-08T23:59:59+03:00'; // жеребкування — щойно закриється реєстрація
export const DAYX_DATE = '2026-08-23';

export const PRICES = [420, 840] as const;
export type Price = (typeof PRICES)[number];

/** Внутрішній код учасника (для адмінки/звірки; в UI гравця не світиться, D-036). */
export const payCode = (num: number) => 'DBC-' + String(num).padStart(2, '0');

/** Лінк банки з предзаповненою сумою (a) і коментом (t). */
export function bankaLink(amount: number, comment: string) {
  if (!BANKA_URL) return '';
  const sep = BANKA_URL.includes('?') ? '&' : '?';
  return `${BANKA_URL}${sep}a=${amount}&t=${encodeURIComponent(comment)}`;
}

/** 5 прямих питань рівня: без жартів, кожне про конкретну навичку. */
export const QUESTIONS: { q: string; opts: string[] }[] = [
  { q: 'Спортивний розряд з настільного тенісу?',
    opts: ['Немає і не було', 'Займався в секції, розряду немає', 'Юнацький розряд', 'Дорослий розряд, КМС або вище'] },
  { q: 'Як часто граєш зараз?',
    opts: ['Практично не граю', 'Кілька разів на рік', '1–2 рази на місяць', 'Щотижня або частіше'] },
  { q: 'Подача з обертанням:',
    opts: ['Не знаю, що це', 'Приймаю через раз', 'Стабільно приймаю', 'Сам подаю з обертанням'] },
  { q: 'Атакувальний удар — накат, топспін:',
    opts: ['Не володію', 'Іноді виходить', 'Впевнено з форхенду', 'З обох боків'] },
  { q: 'Проти явно сильнішого суперника в партії до 11 набираєш:',
    opts: ['0–3 очки', '4–6 очок', '7–9 очок', 'Часто виграю таких'] },
];

/**
 * Рівень 1–10. Чотирьох сходинок було замало: більшість учасників — аматори,
 * і їх треба розводити між собою, а не збивати в одну купу.
 *
 * Складові: навички (подача, топспін, гра проти сильнішого) і частота гри
 * дають 0–12; розряд додає окремо, бо це найпряміший сигнал.
 */
export function levelFromAnswers(answers: number[]): { level: number; sportik: boolean } {
  const a = QUESTIONS.map((_, i) => Math.max(0, Math.min(3, answers[i] ?? 0)));
  const [rank, freq, serve, spin, vs] = a;
  const sportik = rank >= 2;
  const rankBonus = rank === 0 ? 0 : rank === 1 ? 1 : rank === 2 ? 3 : 5;
  const score = freq + serve + spin + vs + rankBonus;      // 0..17
  let level = 1 + Math.round((score / 17) * 9);            // 1..10
  // розрядник у формі не може опинитися серед аматорів: дорослий розряд —
  // не нижче девʼятого, юнацький — не нижче сьомого
  if (freq >= 1) {
    if (rank === 3) level = Math.max(level, 9);
    else if (rank === 2) level = Math.max(level, 7);
  }
  return { level: Math.max(1, Math.min(10, level)), sportik };
}

export const LEVEL_LABEL: Record<number, string> = {
  1: 'Вперше в руках',
  2: 'Новачок',
  3: 'Аматор',
  4: 'Дворовий',
  5: 'Середнячок',
  6: 'Міцний середняк',
  7: 'Шарить',
  8: 'Сильний',
  9: 'Майже спортик',
  10: 'Розрядник',
};

/** Стартовий рейтинг для посіву: рівне розведення 820…1450. */
export const LEVEL_RATING: Record<number, number> = {
  1: 820, 2: 890, 3: 960, 4: 1030, 5: 1100,
  6: 1170, 7: 1240, 8: 1310, 9: 1380, 10: 1450,
};

/**
 * Пакети участі. Назви — щоб людина обирала між «чим» і «чим», а не між
 * двома числами. Перші 10 реєстрацій отримують 20%: місця тримає той,
 * хто наважився першим.
 */
export const EARLY_BIRD_SLOTS = 10;
export const EARLY_BIRD_PCT = 20;

export type PackId = 'player' | 'patron';
export const PACKAGES: Record<PackId, {
  id: PackId; name: string; price: number; tagline: string; perks: string;
}> = {
  player: {
    id: 'player',
    name: 'ГРАВЕЦЬ',
    price: 420,
    tagline: 'Все, щоб грати',
    perks: 'Стіл, сітка, мʼячі, суддівство і призовий фонд.',
  },
  patron: {
    id: 'patron',
    name: 'МЕЦЕНАТ',
    price: 840,
    tagline: 'Те саме + тримаєш турнір',
    perks: 'Твоє імʼя — серед меценатів на афіші й на сайті, окремий знак у складі турніру і згадка на нагородженні.',
  },
};

/** Знижка діє, доки зайнято менше ніж EARLY_BIRD_SLOTS місць. */
export const discountFor = (taken: number) => (taken < EARLY_BIRD_SLOTS ? EARLY_BIRD_PCT : 0);

/** Ціна після знижки, округлена до гривні. */
export const priceWith = (base: number, pct: number) => Math.round(base * (100 - pct) / 100);

/** Ролі волонтерів (VOLONTERY-DEN-X.md). */
export const VOLUNTEER_ROLES = [
  'суддівство на фіналах',
  'фан-станції',
  'зустріч гостей',
  'фото/відео',
  'монтаж/демонтаж',
  'куди скажете',
];

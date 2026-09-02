// Спільна логіка ліги DRUID BATTLE CUP (флоу /join → /ya/[token]).

/** Лінк банки monobank; задається в env, поки порожній — імітація оплати. */
export const BANKA_URL = process.env.NEXT_PUBLIC_BANKA_URL || '';

/** Поки банки нема — тестова ІМІТАЦІЯ оплати (D-035): флоу проходиться до кінця. */
export const MOCK_PAY = !BANKA_URL;

/** Куди слати скріншот переказу (D-036: банка + скріншот у Telegram).
 *  Постав юзернейм бота/орга: 'https://t.me/xxxxx'. Порожньо = текст без лінка. */
export const TG_CONFIRM_URL = process.env.NEXT_PUBLIC_TG_CONFIRM_URL || '';

/** Ключові дати (D-036): ліга 21 день, реєстрація до жеребкування. */
export const DRAW_DATE = '2026-08-02T12:00:00+03:00'; // жеребкування
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
 * Рівень 1–4. Розряд — прямий сигнал: він завжди ставить позначку «спортик»,
 * але рівень 4 дає лише тим, хто ще й грає; розрядник, що не грав роками,
 * отримує 3 — це чесніше і до нього, і до його суперників.
 */
export function levelFromAnswers(answers: number[]): { level: number; sportik: boolean } {
  const a = QUESTIONS.map((_, i) => Math.max(0, Math.min(3, answers[i] ?? 0)));
  const [rank, freq, serve, spin, vs] = a;
  const sportik = rank >= 2;
  if (sportik) return { level: freq >= 1 ? 4 : 3, sportik };
  const score = freq + serve + spin + vs + (rank === 1 ? 1 : 0); // 0..13
  return { level: score <= 3 ? 1 : score <= 7 ? 2 : 3, sportik };
}

export const LEVEL_LABEL: Record<number, string> = {
  1: 'За вайбом',
  2: 'Середнячок',
  3: 'Шарить',
  4: 'Розрядник',
};

/** Ролі волонтерів (VOLONTERY-DEN-X.md). */
export const VOLUNTEER_ROLES = [
  'суддівство на фіналах',
  'фан-станції',
  'зустріч гостей',
  'фото/відео',
  'монтаж/демонтаж',
  'куди скажете',
];

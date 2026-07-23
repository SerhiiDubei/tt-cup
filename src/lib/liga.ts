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

/** 7 питань рівня (D-036): степами, по одному на екран. */
export const QUESTIONS: { q: string; opts: string[] }[] = [
  { q: 'Як часто граєш?', opts: ['Перший раз / пару разів на рік', 'Іноді, під настрій', 'Щотижня', 'Майже щодня'] },
  { q: 'Скільки матчів зіграв за останній місяць?', opts: ['Нуль', '1–5', '6–20', 'Збився з ліку'] },
  { q: 'Подача з підкруткою — це…', opts: ['Це як?', 'Приймаю, але страждаю', 'Сам кручу так, що страждають інші'] },
  { q: 'Бекхенд-топспін?', opts: ['Ем… що?', 'Іноді залітає', 'Моя зброя'] },
  { q: 'Секція / тренер?', opts: ['Ніколи', 'Було в дитинстві', 'Тренуюсь(вався) серйозно'] },
  { q: 'Проти сильнішого суперника ти…', opts: ['Радію досвіду', 'Чіпляюсь за кожен мʼяч', 'Часто перемагаю таких'] },
  { q: 'Свій рівень чесно:', opts: ['Прийшов за вайбом', 'Середнячок', 'Шарю', 'Спортик — тренуюсь / розряд'] },
];

/**
 * Рівень 1–4 із 7 відповідей: нормована сума з вагами; «спортик» — чесна
 * самозаява (останнє питання) або серйозна секція зараз.
 */
export function levelFromAnswers(answers: number[]): { level: number; sportik: boolean } {
  const a = QUESTIONS.map((_, i) => answers[i] ?? 0);
  const sportik = a[6] >= 3 || a[4] >= 2;
  if (sportik) return { level: 4, sportik };
  const norm = QUESTIONS.reduce((s, q, i) => s + a[i] / (q.opts.length - 1), 0) / QUESTIONS.length;
  return { level: 1 + Math.min(2, Math.floor(norm * 3.3)), sportik };
}

export const LEVEL_LABEL: Record<number, string> = {
  1: 'За вайбом',
  2: 'Середнячок',
  3: 'Шарить',
  4: 'Спортик',
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

'use client';

import type { PostHog } from 'posthog-js';

/**
 * Клієнтська аналітика кабінету.
 *
 * Навіщо взагалі: з 8 вересня оплата починається не лише в чаті — у кабінеті
 * зʼявилась кнопка «ОПЛАТИТИ», і для всіх, хто вже зареєстрований, це єдиний
 * шлях до банку. Без цих подій половина платежів у воронці невидима: людина
 * натиснула й пішла в банк, а в статистиці «не платила».
 *
 * Три правила, від яких не відступаємо:
 *  1. Аналітика ніколи не стає на шляху оплати. Завантаження ліниве, кожен
 *     виклик у try/catch, будь-яка помилка — тиша в консолі, а не виняток.
 *  2. Запис сесій у кабінеті вимкнений. На екрані імʼя, телефон і телеграм
 *     людини; знімати це відео заради аналітики — поганий розмін.
 *  3. Особисті дані в події не йдуть. Тільки номер заявки, стан оплати
 *     і рівень — те саме, що вже шле сервер.
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let ph: PostHog | null = null;
let starting: Promise<PostHog | null> | null = null;

/** Той самий distinct_id, що й у серверних подіях про оплату. */
export const playerId = (num: number) => `dbc-player-${num}`;

/**
 * Піднімає posthog-js один раз за життя вкладки.
 *
 * Динамічний import, а не звичайний: бібліотека їде окремим шматком уже
 * після гідрації, тож на першу відмальовку кабінету не впливає взагалі.
 */
async function boot(): Promise<PostHog | null> {
  if (ph) return ph;
  if (!KEY || typeof window === 'undefined') return null;
  if (starting) return starting;
  starting = (async () => {
    try {
      const mod = await import('posthog-js');
      mod.default.init(KEY, {
        api_host: HOST,
        defaults: '2026-05-30',
        person_profiles: 'identified_only',
        // Кабінет — сторінка з персональними даними на екрані
        disable_session_recording: true,
        // Кроки тут іменовані вручну; автозахоплення лише додало б шуму
        autocapture: false,
      });
      // Позначаємо джерело на КОЖНІЙ події, включно з автоматичним $pageview.
      // Без цього перегляди кабінету злились би з переглядами онбордингу
      // і роздули б перший крок воронки «шлях до заявки».
      mod.default.register({ entry: 'cabinet' });
      ph = mod.default;
      return ph;
    } catch {
      return null;   // немає мережі, ріже блокувальник — кабінет це не обходить
    }
  })();
  return starting;
}

/** Підписати людину номером заявки — місток між кабінетом і серверними подіями. */
export function identifyPlayer(num: number, props?: Record<string, unknown>) {
  void (async () => {
    try {
      const p = await boot();
      if (p && num) p.identify(playerId(num), props);
    } catch { /* аналітика мовчить, кабінет працює */ }
  })();
}

/**
 * Подія.
 *
 * `instant` — для кроків просто перед відходом зі сторінки: браузер не встигає
 * відправити звичайну чергу, коли вже почалась навігація в банк.
 */
export function track(event: string, props?: Record<string, unknown>, instant?: boolean) {
  void (async () => {
    try {
      const p = await boot();
      if (!p) return;
      p.capture(event, { entry: 'cabinet', ...props },
        instant ? { send_instantly: true, transport: 'sendBeacon' } : undefined);
    } catch { /* аналітика мовчить, кабінет працює */ }
  })();
}

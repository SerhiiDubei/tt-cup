import crypto from 'node:crypto';
import { PostHog } from 'posthog-node';

/**
 * Серверна аналітика (PostHog).
 *
 * Навіщо окремо від браузера: події з фронтенду ріже кожен блокувальник
 * реклами, а половина з них взагалі не встигає піти, коли людина йде на
 * сторінку банку. Факт оплати нам приносить WayForPay прямо на сервер —
 * і звідси його ніщо заблокувати не може. Тому гроші рахуємо тут.
 *
 * Дві залізні умови:
 *  1. Аналітика ніколи не ламає платіж. Усе в try/catch, помилка тільки в лог.
 *  2. Аналітика ніколи не затримує відповідь WayForPay. Він чекає підписаний
 *     ack, і якщо ми думаємо надто довго — він повторює колбек. Тому жорсткий
 *     ліміт часу, після якого подію кидаємо, а платіж проводимо далі.
 *
 * Змінні оточення (Vercel → Settings → Environment Variables):
 *   NEXT_PUBLIC_POSTHOG_KEY   phc_… — публічний токен проєкту, тільки запис
 *   NEXT_PUBLIC_POSTHOG_HOST  https://eu.i.posthog.com (за замовчуванням)
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/** Скільки максимум чекаємо на PostHog, перш ніж забити й віддати ack. */
const BUDGET_MS = 2500;

export const analyticsReady = () => KEY.length > 0;

/**
 * Той самий distinct_id, яким людина підписана в онбордингу.
 *
 * Це єдиний місток між двома доменами: чат живе на dbc-onboarding, кабінет
 * і оплата — на teniss, а localStorage у них різний. Спільний id зшиває
 * воронку в одну. Секретний токен кабінету сюди не потрапляє ніколи.
 */
export const playerId = (num: number) => `dbc-player-${num}`;

/**
 * Детермінований uuid події з ключа ідемпотентності.
 *
 * WayForPay повторює колбек, поки не отримає ack, тож той самий платіж може
 * прийти двічі. Однаковий ключ дає однаковий uuid, і PostHog не порахує
 * оплату двічі навіть якщо два колбеки прилетять одночасно й обидва
 * побачать заявку ще неоплаченою.
 */
function stableUuid(key: string) {
  const h = crypto.createHash('sha1').update(key).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16),
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32)].join('-');
}

type Payload = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  /** Ключ ідемпотентності: однаковий ключ = одна подія в PostHog. */
  dedupeKey?: string;
};

/**
 * Одна серверна подія. Клієнт створюється й гаситься на кожен виклик:
 * у serverless процес між запитами заморожується, і довгоживуча черга
 * просто не встигла б відправитись.
 */
export async function track({ distinctId, event, properties, dedupeKey }: Payload): Promise<void> {
  if (!analyticsReady()) return;
  let client: PostHog | null = null;
  try {
    client = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
    const send = client.captureImmediate({
      distinctId,
      event,
      properties: { $source: 'server', ...properties },
      ...(dedupeKey ? { uuid: stableUuid(dedupeKey) } : {}),
    });
    await Promise.race([
      send,
      new Promise((_, rej) => setTimeout(() => rej(new Error('posthog timeout')), BUDGET_MS)),
    ]);
  } catch (e) {
    // Свідомо ковтаємо: втрачена подія — прикро, зірваний платіж — катастрофа.
    console.error('[analytics]', event, String((e as Error)?.message ?? e));
  } finally {
    // captureImmediate уже відправив подію — shutdown лише прибирає таймери
    try { await client?.shutdown(1000); } catch { /* уже все одно віддали */ }
  }
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';

/**
 * Колбек WayForPay — єдине місце, де ми дізнаємось про гроші. Тест стереже
 * три речі, помилка в кожній коштує реально: подвійний облік оплати,
 * витік даних картки в аналітику і зірваний платіж через аналітику.
 *
 * Мокаємо тільки зовнішній світ — Supabase і мережу PostHog. Наш власний
 * код (analytics.ts + сам обробник) виконується справжній.
 */

const h = vi.hoisted(() => {
  process.env.WFP_MERCHANT_ACCOUNT = 'test_merchant';
  process.env.WFP_SECRET_KEY = 'test_secret';
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  return {
    sent: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    row: { current: null as Record<string, unknown> | null },
    posthogDown: { on: false },
  };
});

vi.mock('posthog-node', () => ({
  PostHog: class {
    constructor(_key: string, _opts: unknown) {}
    async captureImmediate(msg: Record<string, unknown>) {
      if (h.posthogDown.on) throw new Error('posthog unreachable');
      h.sent.push(msg);
    }
    shutdown() { /* таймерів у моці немає */ }
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  supaServer: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.row.current }) }) }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => { h.updates.push(patch); return { error: null }; },
      }),
    }),
  }),
}));

const { POST } = await import('./route');

/** Незалежна реалізація підпису WayForPay — щоб тест не повторював баг коду. */
const sign = (parts: (string | number)[]) =>
  crypto.createHmac('md5', 'test_secret').update(parts.join(';'), 'utf8').digest('hex');

const CARD = '444455XXXXXX1234';
const REF = 'DBC-47-1757340000000';

function callback(transactionStatus: string, over: Record<string, unknown> = {}) {
  const c: Record<string, unknown> = {
    merchantAccount: 'test_merchant', orderReference: REF, amount: 420,
    currency: 'UAH', authCode: '123456', cardPan: CARD,
    transactionStatus, reasonCode: transactionStatus === 'Approved' ? 1100 : 1105,
    ...over,
  };
  c.merchantSignature = sign([
    c.merchantAccount as string, c.orderReference as string, c.amount as number,
    c.currency as string, c.authCode as string, c.cardPan as string,
    c.transactionStatus as string, c.reasonCode as number,
  ]);
  return c;
}

const post = (body: Record<string, unknown>) =>
  POST(new Request('https://teniss.vercel.app/api/pay/callback', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never);

/** Гравець, який щойно пішов платити: заявка є, статус ще pending. */
const pending = () => ({
  num: 47, paid: false, pay_status: 'pending',
  pay_amount: 420, pay_base: 420, level: 6, is_sportik: false,
});

beforeEach(() => {
  h.sent.length = 0; h.updates.length = 0;
  h.row.current = pending();
  h.posthogDown.on = false;
});

describe('успішна оплата', () => {
  it('пише в базу і шле payment_succeeded з тим самим id, що й онбординг', async () => {
    const res = await post(callback('Approved'));
    expect(res.status).toBe(200);
    expect(h.updates[0]).toMatchObject({ paid: true, pay_status: 'paid' });

    expect(h.sent).toHaveLength(1);
    const e = h.sent[0];
    expect(e.event).toBe('payment_succeeded');
    expect(e.distinctId).toBe('dbc-player-47');
    const p = e.properties as Record<string, unknown>;
    expect(p).toMatchObject({ num: 47, amount: 420, currency: 'UAH', pack: 'player', source: 'wayforpay' });
    expect(p.$set).toMatchObject({ paid: true, pay_status: 'paid' });
  });

  it('меценат розпізнається за базовою ціною заявки', async () => {
    h.row.current = { ...pending(), pay_base: 840, pay_amount: 840 };
    await post(callback('Approved', { amount: 840 }));
    expect((h.sent[0].properties as Record<string, unknown>).pack).toBe('patron');
  });

  it('WayForPay отримує підписаний ack', async () => {
    const res = await post(callback('Approved'));
    const body = await res.json();
    expect(body).toMatchObject({ orderReference: REF, status: 'accept' });
    expect(body.signature).toBe(sign([REF, 'accept', body.time]));
  });
});

describe('ідемпотентність', () => {
  it('повтор колбека не рахує оплату вдруге', async () => {
    await post(callback('Approved'));
    expect(h.sent).toHaveLength(1);

    // WayForPay повторює колбек; у базі вже 'paid'
    h.row.current = { ...pending(), paid: true, pay_status: 'paid' };
    const res = await post(callback('Approved'));

    expect(res.status).toBe(200);          // ack усе одно віддаємо
    expect(h.sent).toHaveLength(1);        // а події другої немає
  });

  it('однаковий платіж дає однаковий uuid — захист від гонки двох колбеків', async () => {
    await post(callback('Approved'));
    h.row.current = pending();             // ніби обидва встигли прочитати pending
    await post(callback('Approved'));
    expect(h.sent).toHaveLength(2);
    expect(h.sent[0].uuid).toBe(h.sent[1].uuid);
    expect(String(h.sent[0].uuid)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('невдача і повернення — окремі події', () => {
  it('відмова банку → payment_failed із причиною', async () => {
    await post(callback('Declined'));
    expect(h.updates[0]).toMatchObject({ pay_status: 'failed' });
    const e = h.sent[0];
    expect(e.event).toBe('payment_failed');
    const p = e.properties as Record<string, unknown>;
    expect(p).toMatchObject({ transaction_status: 'Declined', reason_code: 1105, num: 47 });
    expect(p.$set).toMatchObject({ paid: false, pay_status: 'failed' });
  });

  it('повернення → payment_refunded і знята ознака оплати', async () => {
    h.row.current = { ...pending(), paid: true, pay_status: 'paid' };
    await post(callback('Refunded'));
    expect(h.updates[0]).toMatchObject({ paid: false, pay_status: 'refunded' });
    expect(h.sent[0].event).toBe('payment_refunded');
  });

  it('невдача не потрапляє в подію успіху — у воронці стоїть лише успіх', async () => {
    await post(callback('Declined'));
    expect(h.sent.map((e) => e.event)).not.toContain('payment_succeeded');
  });
});

describe('безпека', () => {
  it('підроблений підпис: ні події, ні запису в базу', async () => {
    const bad = { ...callback('Approved'), merchantSignature: 'deadbeef' };
    const res = await post(bad);
    expect(res.status).toBe(403);
    expect(h.sent).toHaveLength(0);
    expect(h.updates).toHaveLength(0);
  });

  it('дані картки й код авторизації в аналітику не йдуть', async () => {
    await post(callback('Approved'));
    const dump = JSON.stringify(h.sent);
    expect(dump).not.toContain(CARD);
    expect(dump).not.toContain('123456');
    expect(dump).not.toContain('cardPan');
  });
});

describe('аналітика ніколи не зриває платіж', () => {
  it('PostHog лежить — гроші все одно записані, ack віддано', async () => {
    h.posthogDown.on = true;
    const res = await post(callback('Approved'));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('accept');
    expect(h.updates[0]).toMatchObject({ paid: true, pay_status: 'paid' });
  });

  it('заявки під цей orderReference немає — обробник не падає', async () => {
    h.row.current = null;
    const res = await post(callback('Approved'));
    expect(res.status).toBe(200);
    expect(h.sent).toHaveLength(0);
  });
});

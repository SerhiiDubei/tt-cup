import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { verifyCallback, callbackAck, type Callback } from '@/lib/wayforpay';
import { track, playerId } from '@/lib/analytics';
import { PACKAGES } from '@/lib/liga';

export const dynamic = 'force-dynamic';

/** Пакет відновлюємо з базової ціни, зафіксованої в заявці. */
const packOf = (base: number | null | undefined) =>
  base === PACKAGES.patron.price ? 'patron' : base === PACKAGES.player.price ? 'player' : null;

/**
 * serviceUrl для WayForPay. Єдине джерело правди про оплату:
 * підпис перевіряємо обовʼязково, інакше будь-хто міг би оголосити
 * заявку оплаченою простим POST.
 */
export async function POST(req: NextRequest) {
  let c: Callback;
  try {
    const raw = await req.text();
    // WayForPay шле то JSON, то form-urlencoded з єдиним полем
    c = raw.trim().startsWith('{') ? JSON.parse(raw)
      : JSON.parse(decodeURIComponent(raw.replace(/\+/g, ' ')).replace(/^[^{]*/, ''));
  } catch { return NextResponse.json({ error: 'bad_payload' }, { status: 400 }); }

  const ref = c.orderReference ?? '';
  if (!ref) return NextResponse.json({ error: 'no_order' }, { status: 400 });
  if (!verifyCallback(c)) {
    return NextResponse.json({ error: 'bad_signature' }, { status: 403 });
  }

  const ok = c.transactionStatus === 'Approved';
  const refunded = c.transactionStatus === 'Refunded';
  const s = supaServer();

  // Стан ДО оновлення. Потрібен двічі: звідси беремо властивості для
  // аналітики, і за ним видно, чи це справді зміна стану, чи просто повтор
  // колбека — WayForPay шле його знову, поки не отримає ack.
  const { data: before } = await s.from('dbc_players')
    .select('num, paid, pay_status, pay_amount, pay_base, level, is_sportik')
    .eq('pay_order_ref', ref).maybeSingle();

  // Повернення знімає «оплачено»: інакше людина з поверненими грішми
  // лишалась би в списку як оплачена.
  await s.from('dbc_players').update(
    ok
      ? { paid: true, pay_status: 'paid', pay_paid_at: new Date().toISOString() }
      : refunded
        ? { paid: false, pay_status: 'refunded', pay_paid_at: null }
        : { pay_status: 'failed' },
  ).eq('pay_order_ref', ref);

  // Аналітика — після того, як гроші вже записані в базу.
  //
  // Успіх, невдача і повернення це три окремі події, а не одна з ознакою.
  // Так у воронку стає рівно одна подія — оплата, — а невдачі живуть
  // власним списком: це ті, кому треба написати руками, поки не пізно.
  const status = ok ? 'paid' : refunded ? 'refunded' : 'failed';
  if (before && before.pay_status !== status) {
    const pack = packOf(before.pay_base);
    const now = new Date().toISOString();
    // Номер картки й код авторизації свідомо не шлемо: в аналітиці їм робити
    // нічого, а витік звідти дорожчий за будь-який інсайт.
    const common = {
      num: before.num,
      order_ref: ref,
      amount: Number(c.amount ?? before.pay_amount ?? 0),
      currency: c.currency ?? 'UAH',
      pack,
      level: before.level,
      sportik: before.is_sportik,
      source: 'wayforpay',
    };
    await track({
      distinctId: playerId(before.num),
      dedupeKey: `${ref}:${status}`,
      event: ok ? 'payment_succeeded' : refunded ? 'payment_refunded' : 'payment_failed',
      properties: ok
        ? { ...common, $set: { paid: true, pay_status: 'paid', pack, paid_at: now } }
        : refunded
          ? { ...common, $set: { paid: false, pay_status: 'refunded' } }
          : {
              ...common,
              transaction_status: c.transactionStatus ?? 'unknown',
              reason_code: c.reasonCode ?? null,
              $set: { paid: false, pay_status: 'failed' },
            },
    });
  }

  // WayForPay чекає підписане підтвердження, інакше повторює колбек
  return NextResponse.json(callbackAck(ref));
}

import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { verifyCallback, callbackAck, type Callback } from '@/lib/wayforpay';

export const dynamic = 'force-dynamic';

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
  const s = supaServer();
  await s.from('dbc_players').update(
    ok
      ? { paid: true, pay_status: 'paid', pay_paid_at: new Date().toISOString() }
      : { pay_status: c.transactionStatus === 'Refunded' ? 'refunded' : 'failed' },
  ).eq('pay_order_ref', ref);

  // WayForPay чекає підписане підтвердження, інакше повторює колбек
  return NextResponse.json(callbackAck(ref));
}

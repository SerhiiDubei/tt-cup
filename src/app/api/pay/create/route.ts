import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { purchaseForm, wfpReady, WFP } from '@/lib/wayforpay';
import { PACKAGES, discountFor, priceWith, type PackId } from '@/lib/liga';

export const dynamic = 'force-dynamic';

const ORIGINS = new Set(['https://dbc-onboarding.vercel.app', 'http://localhost:3310']);
function cors(res: NextResponse, origin: string | null) {
  if (origin && ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  return res;
}
export async function OPTIONS(req: NextRequest) {
  return cors(new NextResponse(null, { status: 204 }), req.headers.get('origin'));
}

/**
 * Готує платіж: рахує ціну на СЕРВЕРІ (клієнту вірити не можна),
 * фіксує її в заявці й повертає підписані поля форми WayForPay.
 */
export async function POST(req: NextRequest) {
  return cors(await handle(req), req.headers.get('origin'));
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!wfpReady()) {
    return NextResponse.json({ error: 'pay_not_configured' }, { status: 503 });
  }
  let body: { token?: string; pack?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const token = (body.token ?? '').trim();
  const packId = (body.pack === 'patron' ? 'patron' : 'player') as PackId;
  if (!token) return NextResponse.json({ error: 'token_required' }, { status: 400 });

  const s = supaServer();
  const { data: player, error } = await s.from('dbc_players')
    .select('id, num, token, first_name, last_name, phone, paid, pay_order_ref')
    .eq('token', token).maybeSingle();
  if (error || !player) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (player.paid) return NextResponse.json({ error: 'already_paid' }, { status: 409 });

  // знижку рахуємо від кількості вже зайнятих місць, а не від слова клієнта
  const { count } = await s.from('dbc_players')
    .select('id', { count: 'exact', head: true }).eq('kind', 'player');
  const pack = PACKAGES[packId];
  const pct = discountFor((count ?? 1) - 1);   // сам гравець уже в таблиці
  const amount = priceWith(pack.price, pct);

  const orderReference = `DBC-${player.num}-${Date.now()}`;
  await s.from('dbc_players').update({
    pay_order_ref: orderReference,
    pay_status: 'pending',
    pay_amount: amount,
    pay_base: pack.price,
    pay_discount_pct: pct,
  }).eq('id', player.id);

  const form = purchaseForm({
    orderReference,
    amount,
    productName: `Участь у DRUID BATTLE CUP — пакет «${pack.name}»`,
    clientFirstName: player.first_name ?? '',
    clientLastName: player.last_name ?? '',
    clientPhone: player.phone ?? '',
    returnUrl: `https://${WFP.domain}/api/pay/return/${player.token}`,
    serviceUrl: `https://${WFP.domain}/api/pay/callback`,
  });

  return NextResponse.json({ payUrl: WFP.payUrl, form, amount, base: pack.price, discount: pct });
}

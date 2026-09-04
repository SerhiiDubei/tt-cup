import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { verifyCallback, type Callback } from '@/lib/wayforpay';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

/**
 * returnUrl для WayForPay.
 *
 * Банк повертає користувача POST-запитом. Якщо цілити ним прямо в
 * сторінку кабінету, App Router трактує POST як виклик Server Action
 * і віддає «Server action not found». Тому приймаємо POST тут
 * і робимо 303 — браузер далі йде на кабінет звичайним GET.
 */
export async function POST(req: NextRequest, ctx: Params) {
  const { token } = await ctx.params;
  const c = await parseBody(req);
  const state = await applyIfSigned(c);
  return seeOther(req, token, state);
}

/** Деякі сценарії (скасування, повернення з банку) приходять GET-ом. */
export async function GET(req: NextRequest, ctx: Params) {
  const { token } = await ctx.params;
  return seeOther(req, token, null);
}

function seeOther(req: NextRequest, token: string, state: string | null) {
  const url = new URL(`/kabinet/${encodeURIComponent(token)}`, req.nextUrl.origin);
  if (state) url.searchParams.set('pay', state);
  return NextResponse.redirect(url, 303);
}

/** WayForPay шле то JSON, то form-urlencoded, то JSON одним полем форми. */
async function parseBody(req: NextRequest): Promise<Callback> {
  const raw = (await req.text()).trim();
  if (!raw) return {};
  if (raw.startsWith('{')) {
    try { return JSON.parse(raw) as Callback; } catch { return {}; }
  }
  const p = new URLSearchParams(raw);
  const only = [...p.keys()];
  if (only.length === 1 && !p.get(only[0])) {
    try { return JSON.parse(decodeURIComponent(only[0])) as Callback; } catch { return {}; }
  }
  const o: Record<string, string> = {};
  p.forEach((v, k) => { o[k] = v; });
  return o as Callback;
}

/**
 * Джерело правди про оплату — serviceUrl-колбек. Але він може прийти
 * із затримкою, і гравець побачив би «не оплачено». Тому, якщо підпис
 * на returnUrl валідний, проставляємо статус і тут — перевірка та сама,
 * підробити її ззовні не вийде.
 */
async function applyIfSigned(c: Callback): Promise<string | null> {
  const ref = c.orderReference ?? '';
  if (!ref || !c.merchantSignature || !verifyCallback(c)) return null;

  const ok = c.transactionStatus === 'Approved';
  const s = supaServer();
  await s.from('dbc_players').update(
    ok
      ? { paid: true, pay_status: 'paid', pay_paid_at: new Date().toISOString() }
      : { pay_status: c.transactionStatus === 'Refunded' ? 'refunded' : 'failed' },
  ).eq('pay_order_ref', ref);

  return ok ? 'ok' : 'fail';
}

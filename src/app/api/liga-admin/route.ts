import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { payCode } from '@/lib/liga';

export const dynamic = 'force-dynamic';

const FIELDS_LEGACY =
  'id, num, kind, first_name, last_name, nick, telegram, level, is_sportik, volunteer, volunteer_roles, pay_amount, paid, paid_claimed_at, pay_status, pay_order_ref, created_at';
const FIELDS = FIELDS_LEGACY.replace(', created_at', ', withdrawn_at, created_at');
type AdminRow = Record<string, unknown> & { num: number };

/** Список реєстрацій + чек «оплачено» (звірка виписки банки по коду DBC-XX)
 *  + зняття з турніру / повернення у склад. */
export async function POST(req: NextRequest) {
  let body: { code?: string; op?: string; id?: string; paid?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!process.env.ADMIN_CODE || body.code !== process.env.ADMIN_CODE)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const s = supaServer();

  if (body.op === 'list') {
    // select зі змінним списком полів — рядки типізуємо самі
    const load = async (fields: string) => {
      const { data, error } = await s.from('dbc_players').select(fields).order('num', { ascending: true });
      return { rows: (data ?? []) as unknown as AdminRow[], error };
    };
    let { rows, error } = await load(FIELDS);
    // Колонки withdrawn_at ще нема (міграція 2026-09-17 не вставлена): список
    // без неї, а кнопка «Зняти» скаже, що треба вставити SQL.
    if (error && error.code === '42703') ({ rows, error } = await load(FIELDS_LEGACY));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ players: rows.map((r) => ({ ...r, payCode: payCode(r.num) })) });
  }

  if (body.op === 'set_paid') {
    if (!body.id || typeof body.paid !== 'boolean')
      return NextResponse.json({ error: 'bad_args' }, { status: 400 });
    const { error } = await s.from('dbc_players').update({ paid: body.paid }).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Зняття — прапорець, а не видалення: історія оплати лишається (потрібна
  // для REFUND у WayForPay і звірки), а склад на сайті його більше не показує.
  // Гроші тут не рухаємо: повернення робиться в WayForPay, і його колбек сам
  // знімає «оплачено». restore — якщо людина передумала до повернення.
  if (body.op === 'withdraw' || body.op === 'restore') {
    if (!body.id) return NextResponse.json({ error: 'bad_args' }, { status: 400 });
    const withdrawn_at = body.op === 'withdraw' ? new Date().toISOString() : null;
    const { error } = await s.from('dbc_players').update({ withdrawn_at }).eq('id', body.id);
    if (error?.code === '42703')
      return NextResponse.json({
        error: 'Колонки withdrawn_at ще нема: встав supabase/migrations/2026-09-17_dbc_withdrawn.sql у Supabase SQL Editor і повтори',
      }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, withdrawn_at });
  }

  return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
}

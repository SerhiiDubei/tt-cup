import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { payCode } from '@/lib/liga';

export const dynamic = 'force-dynamic';

const FIELDS =
  'id, num, kind, first_name, last_name, nick, telegram, level, is_sportik, volunteer, volunteer_roles, pay_amount, paid, paid_claimed_at, created_at';

/** Список реєстрацій + чек «оплачено» (звірка виписки банки по коду DBC-XX). */
export async function POST(req: NextRequest) {
  let body: { code?: string; op?: string; id?: string; paid?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!process.env.ADMIN_CODE || body.code !== process.env.ADMIN_CODE)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const s = supaServer();

  if (body.op === 'list') {
    const { data, error } = await s.from('dbc_players').select(FIELDS).order('num', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ players: (data ?? []).map((r) => ({ ...r, payCode: payCode(r.num) })) });
  }

  if (body.op === 'set_paid') {
    if (!body.id || typeof body.paid !== 'boolean')
      return NextResponse.json({ error: 'bad_args' }, { status: 400 });
    const { error } = await s.from('dbc_players').update({ paid: body.paid }).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown_op' }, { status: 400 });
}

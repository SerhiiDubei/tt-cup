import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { payCode } from '@/lib/liga';

export const dynamic = 'force-dynamic';

const FIELDS =
  'num, kind, first_name, last_name, nick, telegram, instagram, phone, level, is_sportik, volunteer, volunteer_roles, pay_amount, paid, paid_claimed_at, pay_base, pay_discount_pct, pay_status, auth_user_id, created_at';

function pub(row: Record<string, unknown>) {
  const { auth_user_id, ...rest } = row;
  return { ...rest, payCode: payCode(row.num as number), googleLinked: !!auth_user_id };
}

/** token — uuid-колонка: сміття замість uuid = 22P02 від Postgres → чесний 404. */
const badUuid = (e: { code?: string }) => e.code === '22P02';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const { data, error } = await supaServer()
    .from('dbc_players').select(FIELDS).eq('token', token).maybeSingle();
  if (error && badUuid(error)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ player: pub(data) });
}

/** Єдина дія гравця: «Я оплатив» — ставить мітку для ручної звірки орга. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: { action?: string };
  try { body = await req.json(); } catch { body = {}; }
  if (body.action !== 'claim_paid') return NextResponse.json({ error: 'unknown_action' }, { status: 400 });

  const { data, error } = await supaServer()
    .from('dbc_players')
    .update({ paid_claimed_at: new Date().toISOString() })
    .eq('token', token)
    .select(FIELDS)
    .maybeSingle();
  if (error && badUuid(error)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ player: pub(data) });
}

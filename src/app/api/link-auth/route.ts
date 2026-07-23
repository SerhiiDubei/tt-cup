import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Привʼязка Google-акаунта до гравця (D-041): кабінет шле свій токен-лінк
 * і access_token сесії Supabase; сервер верифікує JWT і пише auth_user_id.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; access_token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!body.token || !body.access_token) return NextResponse.json({ error: 'bad_args' }, { status: 400 });

  const s = supaServer();
  const { data: { user }, error: authErr } = await s.auth.getUser(body.access_token);
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await s
    .from('dbc_players')
    .update({ auth_user_id: user.id })
    .eq('token', body.token)
    .select('num')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_linked_to_other' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, email: user.email });
}

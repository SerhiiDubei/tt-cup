import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Вхід через Google (D-041): за сесією знаходимо гравця → його токен-лінк. */
export async function POST(req: NextRequest) {
  let body: { access_token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!body.access_token) return NextResponse.json({ error: 'bad_args' }, { status: 400 });

  const s = supaServer();
  const { data: { user }, error: authErr } = await s.auth.getUser(body.access_token);
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await s
    .from('dbc_players')
    .select('token')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'no_player' }, { status: 404 });
  return NextResponse.json({ token: data.token });
}

import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Акаунт сервісу (D-043): профіль людини (accounts) + її заявки на турніри.
 * op:'get' — профіль і заявка DBC; op:'save' — оновити профіль (upsert).
 * Якщо таблиці accounts ще нема — dbReady:false (працюємо з даних сесії).
 */
export async function POST(req: NextRequest) {
  let body: {
    access_token?: string; op?: string;
    display_name?: string; nick?: string; telegram?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!body.access_token) return NextResponse.json({ error: 'bad_args' }, { status: 400 });

  const s = supaServer();
  const { data: { user }, error: authErr } = await s.auth.getUser(body.access_token);
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (body.op === 'save') {
    const patch = {
      auth_user_id: user.id,
      display_name: (body.display_name ?? '').trim().slice(0, 80) || null,
      nick: (body.nick ?? '').trim().slice(0, 24) || null,
      telegram: (body.telegram ?? '').trim().slice(0, 40) || null,
      photo_url: (user.user_metadata as { avatar_url?: string }).avatar_url ?? null,
    };
    const { error } = await s.from('accounts').upsert(patch, { onConflict: 'auth_user_id' });
    if (error) {
      if (error.code === 'PGRST205') return NextResponse.json({ dbReady: false });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // op: get
  const meta = user.user_metadata as { full_name?: string; avatar_url?: string };
  let account: Record<string, unknown> | null = null;
  let dbReady = true;
  const acc = await s.from('accounts').select('display_name, nick, telegram, photo_url, created_at')
    .eq('auth_user_id', user.id).maybeSingle();
  if (acc.error) {
    if (acc.error.code === 'PGRST205') dbReady = false;
    else return NextResponse.json({ error: acc.error.message }, { status: 500 });
  } else account = acc.data;

  const entry = await s.from('dbc_players')
    .select('token, kind, nick, first_name, last_name, telegram, level, paid, paid_claimed_at, pay_amount, volunteer')
    .eq('auth_user_id', user.id).maybeSingle();

  return NextResponse.json({
    dbReady,
    profile: {
      display_name: account?.display_name ?? meta.full_name ?? '',
      nick: account?.nick ?? entry.data?.nick ?? '',
      telegram: account?.telegram ?? entry.data?.telegram ?? '',
      photo_url: account?.photo_url ?? meta.avatar_url ?? null,
      email: user.email,
    },
    dbcEntry: entry.data ?? null,
  });
}

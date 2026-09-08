import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

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
 * «Хто я» за сесією Google — щоб зайти в кабінет з чужого пристрою.
 *
 * Особисте посилання живе в localStorage, і на новому телефоні (або у
 * вбудованому браузері Instagram) його просто немає. Але на реєстрації
 * людина вже проходила Google, і заявка привʼязана до акаунта.
 *
 * Токен сесії ОБОВʼЯЗКОВО перевіряємо на сервері: якби ми вірили
 * переданому id, будь-хто відкрив би чужий кабінет.
 */
export async function POST(req: NextRequest) {
  return cors(await handle(req), req.headers.get('origin'));
}

async function handle(req: NextRequest): Promise<NextResponse> {
  let body: { access_token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const at = (body.access_token ?? '').trim();
  if (!at) return NextResponse.json({ error: 'token_required' }, { status: 400 });

  const s = supaServer();
  const { data: { user } } = await s.auth.getUser(at);
  if (!user) return NextResponse.json({ error: 'bad_session' }, { status: 401 });

  const { data } = await s.from('dbc_players')
    .select('token, nick, first_name')
    .eq('auth_user_id', user.id).maybeSingle();

  if (!data) {
    // акаунт справжній, але заявки під ним немає
    return NextResponse.json({ error: 'no_application', email: user.email ?? null }, { status: 404 });
  }
  return NextResponse.json({ token: data.token, name: data.nick || data.first_name || null });
}

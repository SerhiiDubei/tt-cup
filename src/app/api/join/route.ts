import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { levelFromAnswers, payCode, PRICES } from '@/lib/liga';

export const dynamic = 'force-dynamic';

const MAX = { name: 40, nick: 24, telegram: 40 };

/** @нік або лінк t.me → канонічний @нік; будь-що інше ріжемо по довжині. */
function normTelegram(raw: string) {
  const t = raw.trim().replace(/^https?:\/\/(t|telegram)\.me\//i, '@').replace(/^@?/, '@');
  return t.slice(0, MAX.telegram);
}

export async function POST(req: NextRequest) {
  let body: {
    kind?: string; firstName?: string; lastName?: string; nick?: string; telegram?: string;
    answers?: unknown; volunteer?: boolean; roles?: unknown; amount?: number;
    access_token?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  // D-047: авторизація — стандартна частина реєстрації. Верифікуємо сесію,
  // заявка одразу належить акаунту; повторна реєстрація → та сама заявка.
  let userId: string | null = null;
  if (body.access_token) {
    const { data: { user } } = await supaServer().auth.getUser(body.access_token);
    if (user) {
      userId = user.id;
      const existing = await supaServer().from('dbc_players')
        .select('token').eq('auth_user_id', userId).maybeSingle();
      if (existing.data) return NextResponse.json({ token: existing.data.token, already: true });
    }
  }

  // Два шляхи (D-035): 'player' — гра з оплатою; 'volunteer' — просто помогти, без оплати.
  const kind = body.kind === 'volunteer' ? 'volunteer' : 'player';
  const firstName = (body.firstName ?? '').trim();
  const lastName = (body.lastName ?? '').trim();
  const nick = (body.nick ?? '').trim();
  const telegram = normTelegram(body.telegram ?? '');
  if (!firstName || !lastName) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (kind === 'player' && !nick) return NextResponse.json({ error: 'nick_required' }, { status: 400 });
  if (telegram.length < 3) return NextResponse.json({ error: 'telegram_required' }, { status: 400 });
  if (firstName.length > MAX.name || lastName.length > MAX.name || nick.length > MAX.nick)
    return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const answers = Array.isArray(body.answers)
    ? body.answers.slice(0, 7).map((a) => Math.max(0, Math.min(3, Number(a) || 0)))
    : [];
  if (kind === 'player' && answers.length !== 7)
    return NextResponse.json({ error: 'answers_required' }, { status: 400 });
  const { level, sportik } = kind === 'player' ? levelFromAnswers(answers) : { level: 1, sportik: false };

  const amount = kind === 'volunteer' ? 0
    : PRICES.includes(body.amount as 420 | 840) ? (body.amount as number) : 420;
  const volunteer = kind === 'volunteer' || body.volunteer === true;
  const roles = volunteer && Array.isArray(body.roles)
    ? body.roles.filter((r): r is string => typeof r === 'string').map((r) => r.slice(0, 40)).slice(0, 8)
    : [];

  const s = supaServer();
  const { data, error } = await s
    .from('dbc_players')
    .insert({
      kind, first_name: firstName, last_name: lastName, nick: nick || null, telegram,
      level, level_answers: answers, is_sportik: sportik,
      volunteer, volunteer_roles: roles, pay_amount: amount,
      auth_user_id: userId,
    })
    .select('token, num')
    .single();

  // заявка одразу отримує акаунт сервісу
  if (!error && data && userId) {
    const acc = await s.from('accounts')
      .upsert(
        { auth_user_id: userId, display_name: `${firstName} ${lastName}`, nick: nick || null, telegram },
        { onConflict: 'auth_user_id' },
      )
      .select('id').maybeSingle();
    if (acc.data) await s.from('dbc_players').update({ account_id: acc.data.id }).eq('token', data.token);
  }

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'nick_taken' }, { status: 409 });
    // PGRST205 = таблиці ще нема (міграція не накочена) — кажемо чесно
    if (error.code === 'PGRST205') return NextResponse.json({ error: 'db_not_ready' }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ token: data!.token, payCode: payCode(data!.num), amount });
}

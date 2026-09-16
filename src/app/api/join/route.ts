import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { levelFromAnswers, payCode, PACKAGES, type PackId } from '@/lib/liga';

export const dynamic = 'force-dynamic';

const MAX = { name: 40, nick: 24, telegram: 40 };

/** @нік або лінк t.me → канонічний @нік; будь-що інше ріжемо по довжині. */
function normTelegram(raw: string) {
  const t = raw.trim().replace(/^https?:\/\/(t|telegram)\.me\//i, '@').replace(/^@?/, '@');
  return t.slice(0, MAX.telegram);
}

/**
 * CORS для чат-реєстрації (dbc-onboarding.vercel.app): онбординг живе на іншому
 * домені й шле заявку сюди. Дозволяємо лише цей origin; curl і так міг стукати
 * без CORS, тож нового класу доступу не зʼявляється.
 */
const ALLOWED_ORIGINS = new Set([
  'https://dbc-onboarding.vercel.app',
  'http://localhost:3310',
]);

function cors(res: NextResponse, origin: string | null) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.headers.set('Access-Control-Max-Age', '86400');
  }
  return res;
}

export async function OPTIONS(req: NextRequest) {
  return cors(new NextResponse(null, { status: 204 }), req.headers.get('origin'));
}

export async function POST(req: NextRequest) {
  return cors(await handleJoin(req), req.headers.get('origin'));
}

async function handleJoin(req: NextRequest): Promise<NextResponse> {
  let body: {
    kind?: string; firstName?: string; lastName?: string; nick?: string; telegram?: string;
    instagram?: string; phone?: string;
    answers?: unknown; volunteer?: boolean; roles?: unknown; amount?: number; pack?: string;
    access_token?: string;
    /** код передачі місця від гравця, що вибув — див. dbc_transfers */
    transfer?: string;
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
        .select('token, num').eq('auth_user_id', userId).maybeSingle();
      // num віддаємо обовʼязково: онбординг підписує людину як
      // dbc-player-<num>, і без цього поля клієнтські події лишаються
      // під анонімним id, а серверні під номером заявки — два різні списки
      if (existing.data) return NextResponse.json({
        token: existing.data.token, num: existing.data.num, already: true,
      });
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
  const instagram = (body.instagram ?? '').trim().replace(/^@/, '').slice(0, MAX.telegram);
  const phone = (body.phone ?? '').trim().slice(0, 24);
  // контакт обовʼязковий, але це може бути телеграм АБО інстаграм
  if (telegram.length < 3 && instagram.length < 2)
    return NextResponse.json({ error: 'contact_required' }, { status: 400 });
  if (firstName.length > MAX.name || lastName.length > MAX.name || nick.length > MAX.nick)
    return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const answers = Array.isArray(body.answers)
    ? body.answers.slice(0, 5).map((a) => Math.max(0, Math.min(3, Number(a) || 0)))
    : [];
  if (kind === 'player' && answers.length !== 5)
    return NextResponse.json({ error: 'answers_required' }, { status: 400 });
  const { level, sportik } = kind === 'player' ? levelFromAnswers(answers) : { level: 1, sportik: false };

  // ціну рахує сервер: пакет клієнту не довіряємо. Знижок немає —
  // ціна одна для всіх, незалежно від того, коли людина записалась.
  const packId: PackId = body.pack === 'patron' ? 'patron' : 'player';
  const pack = PACKAGES[packId];
  const discountPct = 0;
  const amount = kind === 'volunteer' ? 0 : pack.price;
  const volunteer = kind === 'volunteer' || body.volunteer === true;
  const roles = volunteer && Array.isArray(body.roles)
    ? body.roles.filter((r): r is string => typeof r === 'string').map((r) => r.slice(0, 40)).slice(0, 8)
    : [];

  const s = supaServer();

  // Передача місця: гравець вибув і віддає свій внесок новому. Код видає
  // організатор руками, використовується рівно раз. Перевіряємо ДО вставки:
  // заявка з мертвим кодом не має зʼявитися неоплаченою під виглядом переданої.
  const transferCode = (body.transfer ?? '').trim().toUpperCase();
  let transfer: { code: string; from_num: number; amount: number; order_ref: string | null; note: string | null } | null = null;
  if (transferCode) {
    const t = await s.from('dbc_transfers')
      .select('code, from_num, amount, order_ref, note, used_at')
      .eq('code', transferCode).maybeSingle();
    if (!t.data) return NextResponse.json({ error: 'transfer_invalid' }, { status: 400 });
    if (t.data.used_at) return NextResponse.json({ error: 'transfer_used' }, { status: 409 });
    transfer = t.data;
  }

  const { data, error } = await s
    .from('dbc_players')
    .insert({
      kind, first_name: firstName, last_name: lastName, nick: nick || null,
      telegram: telegram.length >= 3 ? telegram : null,
      instagram: instagram || null, phone: phone || null,
      level, level_answers: answers, is_sportik: sportik,
      volunteer, volunteer_roles: roles,
      pay_amount: transfer ? transfer.amount : amount,
      pay_base: kind === 'volunteer' ? 0 : pack.price, pay_discount_pct: discountPct,
      auth_user_id: userId,
      // Передане місце: внесок уже сплачений тим, хто вибув. Номер його
      // платежу НЕ копіюємо — pay_order_ref унікальний, а обидві заявки
      // мить співіснують. Слід грошей живе в dbc_transfers.order_ref;
      // сюди — синтетичний ref, який колбек банку ніколи не надішле.
      ...(transfer ? {
        paid: true, pay_status: 'transferred', pay_paid_at: new Date().toISOString(),
        pay_order_ref: `TRANSFER:${transfer.code}`, pay_reason: transfer.note, pay_reason_code: 1100,
      } : {}),
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

  // Код спалюємо і того, хто вибув, прибираємо в той самий момент —
  // один вийшов, один зайшов, склад турніру не стрибає.
  if (!error && data && transfer) {
    await s.from('dbc_transfers')
      .update({ used_by: data.num, used_at: new Date().toISOString() })
      .eq('code', transfer.code);
    await s.from('dbc_players').delete().eq('num', transfer.from_num);
  }

  if (error) {
    if (error.code === '23505') {
      // унікальних індексів кілька: нік, google-акаунт, номер платежу
      const which = /nick/.test(error.message) ? 'nick_taken'
        : /auth_user_id/.test(error.message) ? 'already_registered' : 'duplicate';
      return NextResponse.json({ error: which, detail: error.message }, { status: 409 });
    }
    // PGRST205 = таблиці ще нема (міграція не накочена) — кажемо чесно
    if (error.code === 'PGRST205') return NextResponse.json({ error: 'db_not_ready' }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    token: data!.token, num: data!.num, payCode: payCode(data!.num),
    amount: transfer ? transfer.amount : amount,
    ...(transfer ? { transferred: true, paid: true } : {}),
  });
}

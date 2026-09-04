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

/* ---- редагування власних даних ------------------------------------ */

type Patch = {
  first_name?: string; last_name?: string; nick?: string;
  telegram?: string | null; instagram?: string | null; phone?: string;
};

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Нік у телеграмі: приймаємо «@nick», «nick», «t.me/nick», посилання. */
function tgHandle(raw: string) {
  const h = clean(raw).replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
  if (!h) return null;
  return /^[A-Za-z0-9_]{4,32}$/.test(h) ? '@' + h : false;
}
/** Інстаграм зберігаємо без «@». */
function igHandle(raw: string) {
  const h = clean(raw).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '').replace(/^@/, '');
  if (!h) return null;
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : false;
}

/**
 * PATCH — гравець виправляє те, що ввів на реєстрації (у ніку чи
 * контакті легко зробити одруківку, а зв'язатися потім нема як).
 * Рівень, оплату й номер у списку тут не чіпаємо: це не його поля.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: Patch;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  const bad = (field: string, msg: string) =>
    NextResponse.json({ error: 'invalid', field, message: msg }, { status: 400 });

  const upd: Record<string, string | null> = {};

  if (body.first_name !== undefined) {
    const v = clean(body.first_name);
    if (v.length < 2 || v.length > 40) return bad('first_name', 'Імʼя — від 2 до 40 символів.');
    upd.first_name = v;
  }
  if (body.last_name !== undefined) {
    const v = clean(body.last_name);
    if (v.length > 40) return bad('last_name', 'Прізвище — до 40 символів.');
    upd.last_name = v;
  }
  if (body.nick !== undefined) {
    const v = clean(body.nick);
    if (v && !/^[A-Za-z0-9А-Яа-яЇїІіЄєҐґ._\- ]{2,20}$/.test(v)) {
      return bad('nick', 'Нік — 2–20 символів, без спецзнаків.');
    }
    upd.nick = v || null;
  }
  if (body.telegram !== undefined) {
    const v = tgHandle(body.telegram ?? '');
    if (v === false) return bad('telegram', 'Телеграм — 4–32 символи: літери, цифри, «_».');
    upd.telegram = v;
  }
  if (body.instagram !== undefined) {
    const v = igHandle(body.instagram ?? '');
    if (v === false) return bad('instagram', 'Інстаграм — літери, цифри, «.» та «_».');
    upd.instagram = v;
  }
  if (body.phone !== undefined) {
    const digits = String(body.phone ?? '').replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length < 9 || digits.length > 16) {
      return bad('phone', 'Телефон — щонайменше 9 цифр.');
    }
    upd.phone = digits;
  }

  if (!Object.keys(upd).length) return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });

  // звʼязок із гравцем має лишитися бодай один
  const { data: cur, error: curErr } = await supaServer()
    .from('dbc_players').select('telegram, instagram').eq('token', token).maybeSingle();
  if ((curErr && badUuid(curErr)) || !cur) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });
  const tgAfter = upd.telegram !== undefined ? upd.telegram : cur?.telegram ?? null;
  const igAfter = upd.instagram !== undefined ? upd.instagram : cur?.instagram ?? null;
  if (!tgAfter && !igAfter) return bad('telegram', 'Лишається без звʼязку — вкажи телеграм або інстаграм.');

  const { data, error } = await supaServer()
    .from('dbc_players').update(upd).eq('token', token).select(FIELDS).maybeSingle();
  if (error && badUuid(error)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (error && error.code === '23505') return bad('nick', 'Такий нік уже зайнятий.');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ player: pub(data) });
}

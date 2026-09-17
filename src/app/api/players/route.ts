import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const TOTAL_SLOTS = 32;

/* Публічний склад турніру: тільки номер, нік і рівень. Кабінет читає
   звідси стрічку учасників, чат — кількість зайнятих місць. CORS —
   бо чат живе на іншому домені. */
const ORIGINS = new Set(['https://dbc-onboarding.vercel.app', 'http://localhost:3310']);
function cors(res: NextResponse, origin: string | null) {
  if (origin && ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  return res;
}
export async function OPTIONS(req: NextRequest) {
  return cors(new NextResponse(null, { status: 204 }), req.headers.get('origin'));
}

/**
 * Публічний склад турніру. Свідомо віддаємо ЛИШЕ те, що й так видно
 * на сітці: номер, нік і рівень. Контакти, імена, телефони й пошта
 * не виходять за межі сервера.
 */
export async function GET(req: NextRequest) {
  // Хто знявся (withdrawn_at) — не у складі: рядок лишається заради історії
  // оплати, але місце з 32 звільняється і в стрічці його немає.
  const s = supaServer();
  // Друге правило — без колонки: кому внесок повернуто і він не оплачений
  // (paid=false + refunded) — той теж не у складі. paid=true з refunded
  // лишається (напр. №1 — тестова оплата повернута, участь є).
  const query = (withFlag: boolean) => {
    let q = s.from('dbc_players').select('num, nick, level, is_sportik, kind').eq('kind', 'player')
      .or('paid.is.true,pay_status.is.null,pay_status.neq.refunded');
    if (withFlag) q = q.is('withdrawn_at', null);
    return q.order('num', { ascending: true });
  };
  let { data, error } = await query(true);
  // Колонки ще нема (міграцію 2026-09-17_dbc_withdrawn.sql не вставили) —
  // Postgres каже 42703 undefined_column. Тоді склад без фільтра, а не 500:
  // стрічка кабінету й лічильник місць у чаті не мають залежати від порядку
  // «SQL → деплой».
  if (error && error.code === '42703') ({ data, error } = await query(false));

  const origin = req.headers.get('origin');
  if (error) return cors(NextResponse.json({ error: error.message }, { status: 500 }), origin);

  const players = (data ?? []).map((p) => ({
    num: p.num as number,
    nick: (p.nick as string | null) || `Гравець ${p.num}`,
    level: (p.level as number) ?? 1,
    sportik: !!p.is_sportik,
  }));

  return cors(NextResponse.json({ players, total: TOTAL_SLOTS, taken: players.length }), origin);
}

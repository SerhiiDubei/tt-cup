import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const TOTAL_SLOTS = 32;

/* Чат живе на іншому домені й читає звідси кількість зайнятих місць,
   щоб показати знижку «перших 10». Без CORS він отримував помилку
   і мовчки показував ціну без знижки. */
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
  const { data, error } = await supaServer()
    .from('dbc_players')
    .select('num, nick, level, is_sportik, kind')
    .eq('kind', 'player')
    .order('num', { ascending: true });

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

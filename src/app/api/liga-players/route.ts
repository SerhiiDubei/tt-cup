import { NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Публічний список гравців ліги (D-038): нік і рівень — без контактів. */
export async function GET() {
  const s = supaServer();
  const query = (withFlag: boolean) => {
    let q = s.from('dbc_players').select('num, nick, first_name, level, kind, paid, volunteer').eq('kind', 'player')
      .or('paid.is.true,pay_status.is.null,pay_status.neq.refunded'); // не оплачено + повернуто = не у складі
    if (withFlag) q = q.is('withdrawn_at', null); // хто знявся — не в публічному списку
    return q.order('num', { ascending: true });
  };
  let { data, error } = await query(true);
  // 42703 = колонки withdrawn_at ще нема (міграція не вставлена) — список без фільтра, не 500
  if (error && error.code === '42703') ({ data, error } = await query(false));
  if (error) {
    if (error.code === 'PGRST205') return NextResponse.json({ players: [], dbReady: false });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    dbReady: true,
    players: (data ?? []).map((p) => ({
      nick: p.nick || p.first_name,
      level: p.level,
      paid: p.paid,
      volunteer: p.volunteer,
    })),
  });
}

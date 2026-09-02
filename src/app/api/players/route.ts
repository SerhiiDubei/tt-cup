import { NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const TOTAL_SLOTS = 32;

/**
 * Публічний склад турніру. Свідомо віддаємо ЛИШЕ те, що й так видно
 * на сітці: номер, нік і рівень. Контакти, імена, телефони й пошта
 * не виходять за межі сервера.
 */
export async function GET() {
  const { data, error } = await supaServer()
    .from('dbc_players')
    .select('num, nick, level, is_sportik, kind')
    .eq('kind', 'player')
    .order('num', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const players = (data ?? []).map((p) => ({
    num: p.num as number,
    nick: (p.nick as string | null) || `Гравець ${p.num}`,
    level: (p.level as number) ?? 1,
    sportik: !!p.is_sportik,
  }));

  return NextResponse.json({ players, total: TOTAL_SLOTS, taken: players.length });
}

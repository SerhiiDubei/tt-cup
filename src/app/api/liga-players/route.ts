import { NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Публічний список гравців ліги (D-038): нік і рівень — без контактів. */
export async function GET() {
  const { data, error } = await supaServer()
    .from('dbc_players')
    .select('num, nick, first_name, level, kind, paid, volunteer')
    .eq('kind', 'player')
    .order('num', { ascending: true });
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

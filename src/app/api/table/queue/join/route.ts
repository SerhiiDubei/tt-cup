import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { playerId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const playerId = body.playerId ?? '';
  if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });

  const s = supaServer();
  const { data: active } = await s.from('tt_casual_games')
    .select('a,b').eq('status', 'active').maybeSingle();
  if (active && (active.a === playerId || active.b === playerId))
    return NextResponse.json({ error: 'currently_playing' }, { status: 409 });

  const { error } = await s.from('tt_table_queue').insert({ player_id: playerId });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_queued' }, { status: 409 });
    if (error.code === '23503') return NextResponse.json({ error: 'no_such_player' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

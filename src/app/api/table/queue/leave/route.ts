import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { playerId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const playerId = body.playerId ?? '';
  if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });
  const { data, error } = await supaServer()
    .from('tt_table_queue').delete().eq('player_id', playerId).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'not_queued' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

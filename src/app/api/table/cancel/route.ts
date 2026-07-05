import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { gameId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { gameId = '' } = body;
  if (!gameId) return NextResponse.json({ error: 'game_required' }, { status: 400 });

  const s = supaServer();
  // умова status='active' в update → друга паралельна спроба отримає 0 рядків
  const { data: upd, error } = await s.from('tt_casual_games')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('id', gameId).eq('status', 'active').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!upd?.length) return NextResponse.json({ error: 'not_active' }, { status: 409 });
  return NextResponse.json({ ok: true });
}

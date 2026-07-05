import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { validateSets, casualWinner } from '@/lib/table/scoring';
import type { SetScore } from '@/lib/tournament/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { gameId?: string; sets?: SetScore[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { gameId = '', sets = [] } = body;
  if (!gameId) return NextResponse.json({ error: 'game_required' }, { status: 400 });
  const invalid = validateSets(sets);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const s = supaServer();
  const pre = await s.from('tt_casual_games')
    .select('a,b').eq('id', gameId).eq('status', 'active').maybeSingle();
  // збій читання → 500 («спробуй ще»), а не хибний 409 «гра вже закрита»
  if (pre.error) return NextResponse.json({ error: pre.error.message }, { status: 500 });
  const game = pre.data;
  if (!game) return NextResponse.json({ error: 'not_active' }, { status: 409 });

  const winner = casualWinner(game.a, game.b, sets);
  // умова status='active' в update → друга паралельна спроба отримає 0 рядків
  const { data: upd, error } = await s.from('tt_casual_games')
    .update({ sets, winner, status: 'done', ended_at: new Date().toISOString() })
    .eq('id', gameId).eq('status', 'active').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!upd?.length) return NextResponse.json({ error: 'not_active' }, { status: 409 });
  return NextResponse.json({ winner });
}

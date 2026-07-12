import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { validateSets, casualWinner } from '@/lib/table/scoring';
import { eloDelta } from '@/lib/table/elo';
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

  // Elo: рахунок цінніший за рейтинг. Збій читання рейтингів (класика —
  // код задеплоєно раніше за міграцію колонок) НЕ блокує збереження гри:
  // граємо в «без Elo цього разу» замість втрати результату (11.07 так
  // втратили вечір ігор).
  let d = 0;                        // |дельта| переможця; 0 = Elo не нараховано
  let deltaA: number | null = null;
  const { data: ps, error: pErr } = await s.from('tt_players')
    .select('id, rating').in('id', [game.a, game.b]);
  const ratingOf = (id: string) => (ps?.find((p) => p.id === id)?.rating as number) ?? 1000;
  if (pErr) {
    console.warn('elo read failed — зберігаю гру без рейтингу:', pErr.message);
  } else {
    const loser = winner === game.a ? game.b : game.a;
    d = eloDelta(ratingOf(winner), ratingOf(loser));
    deltaA = winner === game.a ? d : -d;
  }

  const base = { sets, winner, status: 'done', ended_at: new Date().toISOString() };
  // умова status='active' в update → друга паралельна спроба отримає 0 рядків,
  // тож рейтинг за одну гру нараховується рівно один раз
  let upd = await s.from('tt_casual_games')
    .update(deltaA === null ? base : { ...base, delta_a: deltaA, delta_b: -deltaA })
    .eq('id', gameId).eq('status', 'active').select('id');
  if (upd.error && deltaA !== null) {
    // з дельтами не записалось (напр., delta_* ще не змігровані) — повтор без Elo
    console.warn('finish з Elo впав, повторюю без нього:', upd.error.message);
    d = 0; deltaA = null;
    upd = await s.from('tt_casual_games').update(base)
      .eq('id', gameId).eq('status', 'active').select('id');
  }
  if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 500 });
  if (!upd.data?.length) return NextResponse.json({ error: 'not_active' }, { status: 409 });

  if (deltaA !== null) {
    // запис нових рейтингів; збій тут не валить відповідь — дельти вже в грі,
    // розбіжність видно і лікується наступною грою (клубний масштаб)
    const [ra, rb] = await Promise.all([
      s.from('tt_players').update({ rating: ratingOf(game.a) + deltaA }).eq('id', game.a),
      s.from('tt_players').update({ rating: ratingOf(game.b) - deltaA }).eq('id', game.b),
    ]);
    if (ra.error || rb.error) console.warn('rating write failed:', (ra.error ?? rb.error)!.message);
  }

  return NextResponse.json({ winner, delta: d });
}

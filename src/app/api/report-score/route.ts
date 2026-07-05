import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { setsValid, winnerFromSets } from '@/lib/tournament/scoring';
import type { SetScore } from '@/lib/tournament/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { token?: string; matchId?: string; sets?: SetScore[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { token, matchId, sets } = body;
  if (!token || !matchId || !Array.isArray(sets))
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  if (!setsValid(sets)) return NextResponse.json({ error: 'invalid_score' }, { status: 400 });

  const s = supaServer();
  const { data: player } = await s.from('tt_players').select('id').eq('token', token).single();
  if (!player) return NextResponse.json({ error: 'bad_token' }, { status: 401 });

  const { data: match } = await s.from('tt_matches').select('*').eq('id', matchId).single();
  if (!match) return NextResponse.json({ error: 'no_match' }, { status: 404 });
  if (match.a !== player.id && match.b !== player.id)
    return NextResponse.json({ error: 'not_your_match' }, { status: 403 });
  if (match.status === 'reported')
    return NextResponse.json({ error: 'already_reported' }, { status: 409 });

  // Reject out-of-phase reports (stale swiss rounds, reports after the round was
  // advanced, or playoff reports while still in swiss and vice versa).
  const { data: t } = await s.from('tt_tournament').select('status, current_round').eq('id', 'main').single();
  if (!t) return NextResponse.json({ error: 'no_tournament' }, { status: 409 });
  if (match.stage === 'swiss') {
    if (t.status !== 'swiss' || match.round !== String(t.current_round))
      return NextResponse.json({ error: 'wrong_phase' }, { status: 409 });
  } else if (match.stage === 'playoff') {
    if (t.status !== 'playoff')
      return NextResponse.json({ error: 'wrong_phase' }, { status: 409 });
  } else {
    return NextResponse.json({ error: 'wrong_phase' }, { status: 409 });
  }

  const winner = winnerFromSets(match.a, match.b, sets);
  if (!winner) return NextResponse.json({ error: 'no_winner' }, { status: 400 });

  const { error } = await s.from('tt_matches')
    .update({ sets, winner, status: 'reported' }).eq('id', matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, winner });
}

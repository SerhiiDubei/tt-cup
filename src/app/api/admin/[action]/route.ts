import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { loadState } from '@/lib/state';
import { generateSwissRound } from '@/lib/tournament/swiss';
import { seedPlayoff, advancePlayoff, champion } from '@/lib/tournament/playoff';
import { tournamentPlayers } from '@/lib/tournament/standings';
import type { Match } from '@/lib/tournament/types';

export const dynamic = 'force-dynamic';

type Gen = Omit<Match, 'id'>;
function toRows(ms: Gen[]) {
  return ms.map((m) => ({
    stage: m.stage, round: String(m.round), slot: m.slot,
    a: m.a, b: m.b ?? null,
    seed_a: m.seed_a ?? null, seed_b: m.seed_b ?? null,
    sets: m.sets ?? [], winner: m.winner ?? null, status: m.status,
  }));
}
const roundReported = (matches: Match[], stage: string, round: string) => {
  const r = matches.filter((m) => m.stage === stage && m.round === round);
  return r.length > 0 && r.every((m) => m.status === 'reported');
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  let body: { code?: string };
  try { body = await req.json(); } catch { body = {}; }
  if (!process.env.ADMIN_CODE || body.code !== process.env.ADMIN_CODE)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const s = supaServer();
  const { tournament: t, players, matches } = await loadState();

  try {
    if (action === 'start') {
      if (t.status !== 'registration') return NextResponse.json({ error: 'not_registration' }, { status: 409 });
      // load-bearing for round 1: seed-order pairing bypasses computeStandings,
      // so this is the ONLY casual-player filter on that path — do not remove as "redundant"
      const eligible = tournamentPlayers(players);
      if (eligible.length < 2) return NextResponse.json({ error: 'need_2_players' }, { status: 409 });
      await s.from('tt_matches').insert(toRows(generateSwissRound(eligible, [], 1) as Gen[]));
      await s.from('tt_tournament').update({ status: 'swiss', current_round: 1 }).eq('id', 'main');
      return NextResponse.json({ ok: true, round: 1 });
    }

    if (action === 'next-round') {
      if (t.status !== 'swiss') return NextResponse.json({ error: 'not_swiss' }, { status: 409 });
      if (!roundReported(matches, 'swiss', String(t.current_round)))
        return NextResponse.json({ error: 'round_incomplete' }, { status: 409 });
      if (t.current_round >= t.total_rounds)
        return NextResponse.json({ error: 'use_to_playoff' }, { status: 409 });
      const next = t.current_round + 1;
      await s.from('tt_matches').insert(toRows(generateSwissRound(tournamentPlayers(players), matches, next) as Gen[]));
      await s.from('tt_tournament').update({ current_round: next }).eq('id', 'main');
      return NextResponse.json({ ok: true, round: next });
    }

    if (action === 'to-playoff') {
      if (t.status !== 'swiss') return NextResponse.json({ error: 'not_swiss' }, { status: 409 });
      if (!roundReported(matches, 'swiss', String(t.current_round)))
        return NextResponse.json({ error: 'round_incomplete' }, { status: 409 });
      if (t.current_round < t.total_rounds)
        return NextResponse.json({ error: 'swiss_not_finished' }, { status: 409 });
      const qf = seedPlayoff(tournamentPlayers(players), matches);
      if (qf.length === 0) return NextResponse.json({ error: 'need_8_players' }, { status: 409 });
      await s.from('tt_matches').insert(toRows(qf as Gen[]));
      await s.from('tt_tournament').update({ status: 'playoff' }).eq('id', 'main');
      return NextResponse.json({ ok: true, stage: 'QF' });
    }

    if (action === 'advance') {
      if (t.status !== 'playoff') return NextResponse.json({ error: 'not_playoff' }, { status: 409 });
      const champ = champion(matches);
      if (champ) {
        await s.from('tt_tournament').update({ status: 'done', champion_id: champ }).eq('id', 'main');
        return NextResponse.json({ ok: true, champion: champ });
      }
      const next = advancePlayoff(players, matches);
      if (!next.length) return NextResponse.json({ error: 'nothing_to_advance' }, { status: 409 });
      await s.from('tt_matches').insert(toRows(next as Gen[]));
      return NextResponse.json({ ok: true, created: next.length });
    }

    if (action === 'reset') {
      await s.from('tt_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await s.from('tt_tournament')
        .update({ status: 'registration', current_round: 0, champion_id: null }).eq('id', 'main');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

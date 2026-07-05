import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { startError } from '@/lib/table/eligibility';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { a?: string; b?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { a = '', b = '' } = body;
  if (!a || !b) return NextResponse.json({ error: 'players_required' }, { status: 400 });

  const s = supaServer();
  const [queue, last] = await Promise.all([
    s.from('tt_table_queue').select('player_id'),
    s.from('tt_casual_games').select('winner').eq('status', 'done')
      .order('ended_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const queueIds = (queue.data ?? []).map((q) => q.player_id as string);
  const err = startError(a, b, queueIds, (last.data?.winner as string) ?? null);
  if (err) return NextResponse.json({ error: err }, { status: 409 });

  // Унікальний індекс tt_casual_one_active ловить гонку двох одночасних стартів.
  const { data, error } = await s.from('tt_casual_games')
    .insert({ a, b }).select('id').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'table_busy' }, { status: 409 });
    if (error.code === '23503') return NextResponse.json({ error: 'no_such_player' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await s.from('tt_table_queue').delete().in('player_id', [a, b]);
  return NextResponse.json({ id: data!.id });
}

import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { isValidArtUrl } from '@/lib/art-url';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { playerId?: string; art?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { playerId = '', art } = body;
  if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });
  if (!isValidArtUrl(art)) return NextResponse.json({ error: 'bad_art' }, { status: 400 });

  const s = supaServer();
  const { data: p } = await s.from('tt_players').select('hero').eq('id', playerId).maybeSingle();
  if (!p) return NextResponse.json({ error: 'no_such_player' }, { status: 404 });
  const { error } = await s.from('tt_players')
    .update({ hero: { ...(p.hero as object), art } }).eq('id', playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

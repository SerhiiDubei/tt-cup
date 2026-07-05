import { NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import type { Player } from '@/lib/tournament/types';

export const dynamic = 'force-dynamic';

/**
 * Resolve the player who owns a private `token` link.
 *
 * GET /api/me/:token → `{ player }` (incl. `id`, never the token) or 404.
 * The token is the player's secret identity (stored client-side under
 * `tt_token`); this route lets the /me page learn its own player id without
 * exposing tokens in the public /api/state snapshot.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'no_token' }, { status: 400 });
    }

    const s = supaServer();
    const { data, error } = await s
      .from('tt_players')
      .select('id, name, nickname, hero, motto, seed')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ player: data as Player });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

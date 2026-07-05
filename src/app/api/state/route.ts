import { NextResponse } from 'next/server';
import { loadState, publicPlayers } from '@/lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { tournament, players, matches } = await loadState();
    return NextResponse.json({ tournament, players: publicPlayers(players), matches });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

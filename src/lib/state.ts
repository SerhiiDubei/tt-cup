import { supaServer } from './supabase/server';
import type { Player, Match, Tournament } from './tournament/types';

export type FullState = { tournament: Tournament; players: Player[]; matches: Match[] };

/** Load the full tournament snapshot from Supabase (server, secret key). */
export async function loadState(): Promise<FullState> {
  const s = supaServer();
  const [t, p, m] = await Promise.all([
    s.from('tt_tournament').select('*').eq('id', 'main').single(),
    s.from('tt_players').select('*').order('created_at', { ascending: true }),
    s.from('tt_matches').select('*').order('round', { ascending: true }).order('slot', { ascending: true }),
  ]);
  return {
    tournament: (t.data as Tournament) ?? null!,
    players: (p.data as Player[]) ?? [],
    matches: (m.data as Match[]) ?? [],
  };
}

/** Strip secret token before sending players to the browser. */
export function publicPlayers(players: (Player & { token?: string })[]) {
  return players.map(({ token, ...rest }) => rest);
}

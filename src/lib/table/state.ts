import { supaServer } from '@/lib/supabase/server';
import { publicPlayers } from '@/lib/state';
import { computeLeaderboard } from './leaderboard';
import type { CasualGame, QueueEntry } from './types';
import type { Player } from '@/lib/tournament/types';

const RECENT_LIMIT = 20;

export async function loadTableState() {
  const s = supaServer();
  const [players, active, done, queue] = await Promise.all([
    s.from('tt_players').select('*').order('created_at', { ascending: true }),
    s.from('tt_casual_games').select('*').eq('status', 'active').maybeSingle(),
    s.from('tt_casual_games').select('*').eq('status', 'done')
      .order('ended_at', { ascending: false }).limit(500),
    s.from('tt_table_queue').select('*').order('joined_at', { ascending: true }),
  ]);
  const doneGames = (done.data as CasualGame[]) ?? [];
  return {
    game: (active.data as CasualGame | null) ?? null,
    queue: (queue.data as QueueEntry[]) ?? [],
    players: publicPlayers((players.data as (Player & { token?: string })[]) ?? []),
    leaderboard: computeLeaderboard(doneGames),
    recent: doneGames.slice(0, RECENT_LIMIT),
    lastWinner: doneGames[0]?.winner ?? null,
  };
}
export type TableState = Awaited<ReturnType<typeof loadTableState>>;

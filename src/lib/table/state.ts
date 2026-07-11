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
  // не маскуємо збій читання під «порожній стіл» — хай роут віддасть 500,
  // а кіоск збереже останній добрий стан замість блимання пустим екраном
  const err = players.error ?? active.error ?? done.error ?? queue.error;
  if (err) throw new Error(err.message);
  const doneGames = (done.data as CasualGame[]) ?? [];
  const allPlayers = (players.data as (Player & { token?: string; rating?: number })[]) ?? [];
  const ratings = new Map(allPlayers.map((p) => [p.id, p.rating ?? 1000]));
  return {
    game: (active.data as CasualGame | null) ?? null,
    queue: (queue.data as QueueEntry[]) ?? [],
    players: publicPlayers(allPlayers),
    leaderboard: computeLeaderboard(doneGames, ratings),
    recent: doneGames.slice(0, RECENT_LIMIT),
    lastWinner: doneGames[0]?.winner ?? null,
  };
}
export type TableState = Awaited<ReturnType<typeof loadTableState>>;

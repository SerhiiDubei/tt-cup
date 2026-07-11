import type { SetScore } from '@/lib/tournament/types';

export type CasualGame = {
  id: string; a: string; b: string;
  sets: SetScore[]; winner: string | null;
  status: 'active' | 'done' | 'cancelled';
  started_at: string; ended_at: string | null;
  /** Elo-дельти цієї гри (+d переможцю, −d лузеру); NULL у ігор до запуску рейтингу */
  delta_a?: number | null; delta_b?: number | null;
};
export type QueueEntry = { id: string; player_id: string; joined_at: string };
export type LeaderRow = { id: string; rating: number; wins: number; losses: number; streak: number };

export type Title = 'giant' | 'comeback' | 'marathon' | 'lightning';
/** Рядок топу з «шоу-пакетом»: рух за добу, форма (напр. 'WWLWW'), титули. */
export type BoardRow = LeaderRow & { move: number | null; form: string; titles: Title[] };

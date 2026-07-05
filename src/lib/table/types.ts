import type { SetScore } from '@/lib/tournament/types';

export type CasualGame = {
  id: string; a: string; b: string;
  sets: SetScore[]; winner: string | null;
  status: 'active' | 'done' | 'cancelled';
  started_at: string; ended_at: string | null;
};
export type QueueEntry = { id: string; player_id: string; joined_at: string };
export type LeaderRow = { id: string; wins: number; losses: number; streak: number };

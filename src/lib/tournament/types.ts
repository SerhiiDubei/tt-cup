export type Hero = { color: string; shape: string; emblem: string; style: string; theme?: string; art?: string };
export type Player = { id: string; name: string; nickname: string; hero: Hero; motto?: string; seed: number; casual?: boolean; rating?: number };
export type SetScore = [number, number];
export type Match = { id: string; stage: 'swiss'|'playoff'; round: string; slot: number;
  a: string; b: string|null; seed_a?: number|null; seed_b?: number|null;
  sets: SetScore[]; winner: string|null; status: 'pending'|'reported' };
export type Tournament = { id: string; name: string; status: 'registration'|'swiss'|'playoff'|'done';
  current_round: number; total_rounds: number; reg_deadline?: string; champion_id?: string|null };

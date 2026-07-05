import type { SetScore } from '@/lib/tournament/types';
import type { TableState } from './state';

// дубль приватного jpost з lib/api.ts — консолідувати, якщо з'явиться третій копіювальник
async function jpost(url: string, body: unknown, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('timeout');
    throw e;
  } finally { clearTimeout(id); }
}

export async function getTableState(): Promise<TableState> {
  const r = await fetch('/api/table/state', { cache: 'no-store' });
  if (!r.ok) throw new Error('state_failed');
  return r.json();
}
export const startGame = (a: string, b: string) => jpost('/api/table/start', { a, b }) as Promise<{ id: string }>;
export const finishGame = (gameId: string, sets: SetScore[]) => jpost('/api/table/finish', { gameId, sets }) as Promise<{ winner: string }>;
export const cancelGame = (gameId: string) => jpost('/api/table/cancel', { gameId });
export const joinQueue = (playerId: string) => jpost('/api/table/queue/join', { playerId });
export const leaveQueue = (playerId: string) => jpost('/api/table/queue/leave', { playerId });
export const quickAddPlayer = (name: string, style?: string) => jpost('/api/table/player', { name, style }) as Promise<{ id: string }>;
export const setPlayerArt = (playerId: string, art: string) => jpost('/api/table/player/avatar', { playerId, art });

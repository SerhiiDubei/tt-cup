import type { Player, Match, Tournament, SetScore, Hero } from './tournament/types';

export type StateResp = { tournament: Tournament; players: Player[]; matches: Match[] };

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
  } finally {
    clearTimeout(id);
  }
}

export async function getState(): Promise<StateResp> {
  const r = await fetch('/api/state', { cache: 'no-store' });
  if (!r.ok) throw new Error('state_failed');
  return r.json();
}
export function register(p: { name: string; nickname: string; hero: Hero; motto?: string }) {
  return jpost('/api/register', p) as Promise<{ id: string; token: string }>;
}
export function reportScore(token: string, matchId: string, sets: SetScore[]) {
  return jpost('/api/report-score', { token, matchId, sets });
}
export function admin(action: 'start' | 'next-round' | 'to-playoff' | 'advance' | 'reset', code: string) {
  return jpost(`/api/admin/${action}`, { code });
}
export function genAvatar(traits: Record<string, string>) {
  return jpost('/api/avatar', { traits }, 90000) as Promise<{ url: string; bytes: number }>;
}
export function stylizeSelfie(selfie: string, style: string) {
  return jpost('/api/avatar', { selfie, style }, 120000) as Promise<{ url: string; bytes: number }>;
}

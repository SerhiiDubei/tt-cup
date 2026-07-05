import type { CasualGame, LeaderRow } from './types';

/** W-L і поточний вінстрік з done-ігор. Гравці без ігор не потрапляють у рядки. */
export function computeLeaderboard(games: CasualGame[]): LeaderRow[] {
  const done = games
    .filter((x) => x.status === 'done' && x.winner)
    .sort((x, y) => (x.ended_at! < y.ended_at! ? -1 : 1)); // старі → нові
  const rows = new Map<string, LeaderRow>();
  const row = (id: string) => {
    if (!rows.has(id)) rows.set(id, { id, wins: 0, losses: 0, streak: 0 });
    return rows.get(id)!;
  };
  for (const gm of done) {
    const w = row(gm.winner!), l = row(gm.winner === gm.a ? gm.b : gm.a);
    w.wins++; w.streak++;
    l.losses++; l.streak = 0;
  }
  return [...rows.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses);
}

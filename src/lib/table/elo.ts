/**
 * Класичний Elo (спека, Addendum 2026-07-11): K=32, нульова сума.
 * Дельта рахується від очікуваного результату переможця; переможець +d, лузер −d.
 */
const K = 32;

/** Ймовірність перемоги гравця з рейтингом ra проти rb (0..1) — для табло шансів. */
export const winProb = (ra: number, rb: number) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

export function eloDelta(winnerRating: number, loserRating: number): number {
  const expectedWin = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(1, Math.round(K * (1 - expectedWin))); // перемога ніколи не дає 0
}

export type League = { name: string; min: number };

/** Ліги від найвищої до найнижчої. Пороги — спека Addendum. */
export const LEAGUES: League[] = [
  { name: 'ЛЕГЕНДА', min: 1300 },
  { name: 'МАЙСТЕР', min: 1200 },
  { name: 'ПРОФІ', min: 1125 },
  { name: 'БОЄЦЬ', min: 1050 },
  { name: 'НОВАЧОК', min: 0 },
];

export function leagueOf(rating: number): League {
  return LEAGUES.find((l) => rating >= l.min) ?? LEAGUES[LEAGUES.length - 1];
}

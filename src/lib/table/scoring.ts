import type { SetScore } from '@/lib/tournament/types';

const MAX_POINTS = 99;

/** null = ok, інакше snake_code помилки (той самий код летить у API 4xx). */
export function validateSets(sets: SetScore[]): string | null {
  if (!Array.isArray(sets) || sets.length === 0) return 'no_sets';
  for (const s of sets) {
    if (!Array.isArray(s) || s.length !== 2) return 'bad_points';
    const [x, y] = s;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return 'bad_points';
    if (x < 0 || y < 0 || x > MAX_POINTS || y > MAX_POINTS) return 'bad_points';
    if (x === y) return 'set_tied';
  }
  const aw = sets.filter(([x, y]) => x > y).length;
  if (aw * 2 === sets.length) return 'match_tied'; // порівну виграних сетів
  return null;
}

/** Переможець матчу за більшістю виграних сетів. Викликати ПІСЛЯ validateSets. */
export function casualWinner(a: string, b: string, sets: SetScore[]): string {
  const aw = sets.filter(([x, y]) => x > y).length;
  return aw > sets.length - aw ? a : b;
}

import type { SetScore } from './types';

/**
 * Best-of-5: the first side to win {@link GAMES_TO_WIN} games wins the match.
 */
export const GAMES_TO_WIN = 3;

/**
 * Count how many games each side has won from a list of set scores.
 * A game goes to the higher score; tied set scores (which should not occur in
 * real play) award the game to nobody.
 *
 * @returns `[gamesForA, gamesForB]`
 */
export function gamesFromSets(sets: SetScore[]): [number, number] {
  let a = 0;
  let b = 0;
  for (const [x, y] of sets) {
    if (x > y) a++;
    else if (y > x) b++;
  }
  return [a, b];
}

/**
 * Determine the winning player id from the set scores, or `null` if the match
 * is not yet decided (nobody has reached {@link GAMES_TO_WIN} games).
 */
export function winnerFromSets(
  aId: string,
  bId: string,
  sets: SetScore[],
): string | null {
  const [a, b] = gamesFromSets(sets);
  if (a >= GAMES_TO_WIN && a > b) return aId;
  if (b >= GAMES_TO_WIN && b > a) return bId;
  return null;
}

/**
 * Maximum number of sets in a best-of-5 match (3-2 is the longest result).
 */
export const MAX_SETS = 2 * GAMES_TO_WIN - 1;

/**
 * Upper bound on a single game's point score. Real table-tennis games end at
 * 11 (or higher under deuce); this cap rejects absurd inflated values while
 * still allowing long deuces.
 */
export const MAX_POINTS = 30;

/**
 * A single set [x, y] is a legal table-tennis game when both scores are
 * non-negative integers within bounds, it is not tied, and the winner has at
 * least 11 points while winning by 2 (deuce rule). This prevents arbitrary
 * point values (which feed the standings tiebreakers) from being persisted.
 */
function setScoreLegal(set: SetScore): boolean {
  if (!Array.isArray(set) || set.length !== 2) return false;
  const [x, y] = set;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x > MAX_POINTS || y > MAX_POINTS) return false;
  if (x === y) return false;
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return hi >= 11 && hi - lo >= 2;
}

/**
 * A best-of-5 result is valid only when exactly one side has reached
 * {@link GAMES_TO_WIN} games and the other side has strictly fewer. This
 * rejects undecided matches (e.g. 2-1), impossible over-counts (4-1) and
 * impossible double-wins (3-3).
 *
 * It additionally enforces that the supplied set count is within bounds and
 * that every individual set is a legal, bounded table-tennis game, so that the
 * raw point values persisted to the DB (and used by the standings set/point
 * tiebreakers) cannot be inflated or forged.
 */
export function setsValid(sets: SetScore[]): boolean {
  if (!Array.isArray(sets) || sets.length === 0 || sets.length > MAX_SETS) return false;
  if (!sets.every(setScoreLegal)) return false;
  const [a, b] = gamesFromSets(sets);
  return (
    (a === GAMES_TO_WIN && b < GAMES_TO_WIN) ||
    (b === GAMES_TO_WIN && a < GAMES_TO_WIN)
  );
}

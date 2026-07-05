import { describe, it, expect } from 'vitest';
import {
  GAMES_TO_WIN,
  gamesFromSets,
  winnerFromSets,
  setsValid,
} from './scoring';
import type { SetScore } from './types';

describe('scoring', () => {
  // --- from plan Task 2.1 ---
  describe('gamesFromSets', () => {
    it('counts games (3-1)', () => {
      expect(gamesFromSets([[11, 7], [9, 11], [11, 5], [11, 8]])).toEqual([3, 1]);
    });

    it('counts games for a clean sweep (3-0)', () => {
      expect(gamesFromSets([[11, 7], [11, 9], [11, 5]])).toEqual([3, 0]);
    });

    it('returns [0,0] for empty sets', () => {
      expect(gamesFromSets([])).toEqual([0, 0]);
    });

    it('ignores tied sets (no winner of that game)', () => {
      // A tied game score never happens in real play, but the counter must
      // not award a game to either side.
      expect(gamesFromSets([[11, 11], [11, 7]])).toEqual([1, 0]);
    });

    it('counts B-favoured sets correctly (1-3)', () => {
      expect(gamesFromSets([[11, 7], [9, 11], [5, 11], [8, 11]])).toEqual([1, 3]);
    });
  });

  describe('winnerFromSets', () => {
    it('winner = side with 3 games (A wins 3-0)', () => {
      expect(winnerFromSets('A', 'B', [[11, 7], [11, 9], [11, 5]])).toBe('A');
    });

    it('winner = B when B reaches 3 games (1-3)', () => {
      expect(winnerFromSets('A', 'B', [[11, 7], [9, 11], [5, 11], [8, 11]])).toBe('B');
    });

    it('winner from a full 5-set match (3-2 to A)', () => {
      expect(
        winnerFromSets('A', 'B', [[11, 7], [9, 11], [11, 5], [8, 11], [11, 9]]),
      ).toBe('A');
    });

    it('returns null when nobody has 3 games yet', () => {
      expect(winnerFromSets('A', 'B', [[11, 7], [9, 11]])).toBeNull();
    });

    it('returns null for empty sets', () => {
      expect(winnerFromSets('A', 'B', [])).toBeNull();
    });

    it('uses the provided ids, not literals', () => {
      expect(
        winnerFromSets('alice', 'bob', [[11, 7], [11, 9], [11, 5]]),
      ).toBe('alice');
    });
  });

  describe('setsValid', () => {
    it('invalid until someone reaches 3', () => {
      expect(setsValid([[11, 7], [9, 11]])).toBe(false);
    });

    it('valid at 3-1', () => {
      expect(setsValid([[11, 7], [9, 11], [11, 5], [11, 8]])).toBe(true);
    });

    it('valid at 3-0', () => {
      expect(setsValid([[11, 7], [11, 9], [11, 5]])).toBe(true);
    });

    it('valid at 3-2', () => {
      expect(setsValid([[11, 7], [9, 11], [11, 5], [8, 11], [11, 9]])).toBe(true);
    });

    it('invalid for empty sets', () => {
      expect(setsValid([])).toBe(false);
    });

    it('invalid when both sides reach 3 (impossible best-of-5)', () => {
      // 6 games played, 3-3 — not a valid best-of-5 result.
      expect(
        setsValid([[11, 7], [9, 11], [11, 5], [8, 11], [11, 9], [9, 11]]),
      ).toBe(false);
    });

    it('invalid when one side exceeds 3 games (4-1)', () => {
      // More than 3 winning games for one side can't happen in best-of-5.
      expect(
        setsValid([[11, 7], [9, 11], [11, 5], [11, 8], [11, 6]]),
      ).toBe(false);
    });

    it('invalid when leader has fewer than 3 games (2-1)', () => {
      expect(setsValid([[11, 7], [9, 11], [11, 5]])).toBe(false);
    });
  });

  describe('GAMES_TO_WIN constant', () => {
    it('is 3 (best-of-5)', () => {
      expect(GAMES_TO_WIN).toBe(3);
    });
  });

  // --- spec §10 edge case: bye = auto-win 3:0 ---
  describe('bye auto-win (spec §10)', () => {
    it('a 3-0 sweep is a valid auto-win result', () => {
      const byeSets: SetScore[] = [[11, 0], [11, 0], [11, 0]];
      expect(setsValid(byeSets)).toBe(true);
      expect(winnerFromSets('player', null as unknown as string, byeSets)).toBe('player');
    });
  });

  // =====================================================================
  // ADVERSARIAL probes — hunting for real bugs (off-by-one, mutation,
  // tie-break, deuce, incomplete/empty sets, impossible distributions).
  // =====================================================================
  describe('ADVERSARIAL: gamesFromSets', () => {
    it('does NOT mutate the input array', () => {
      const sets: SetScore[] = [[11, 7], [9, 11], [11, 5], [11, 8]];
      const snapshot = JSON.parse(JSON.stringify(sets));
      gamesFromSets(sets);
      expect(sets).toEqual(snapshot);
    });

    it('handles deuce-style high scores (12-10 etc.)', () => {
      expect(gamesFromSets([[12, 10], [10, 12], [13, 11], [15, 13]])).toEqual([3, 1]);
    });

    it('counts a single set', () => {
      expect(gamesFromSets([[11, 9]])).toEqual([1, 0]);
    });

    it('treats every set as a tie -> [0,0]', () => {
      expect(gamesFromSets([[11, 11], [5, 5], [0, 0]])).toEqual([0, 0]);
    });

    it('a 0-0 (empty/unstarted) set counts for nobody', () => {
      expect(gamesFromSets([[11, 7], [11, 9], [11, 5], [0, 0]])).toEqual([3, 0]);
    });
  });

  describe('ADVERSARIAL: winnerFromSets', () => {
    it('3-2 to B is decided for B', () => {
      expect(
        winnerFromSets('A', 'B', [[7, 11], [11, 9], [5, 11], [11, 8], [9, 11]]),
      ).toBe('B');
    });

    it('does NOT declare a winner at 3-3 (impossible in bo5)', () => {
      expect(
        winnerFromSets('A', 'B', [[11, 7], [9, 11], [11, 5], [8, 11], [11, 9], [9, 11]]),
      ).toBeNull();
    });

    it('declares winner even on an over-counted 4-1 (someone hit 3 first)', () => {
      // setsValid rejects this, but winnerFromSets only needs a>=3 && a>b.
      expect(
        winnerFromSets('A', 'B', [[11, 7], [9, 11], [11, 5], [11, 8], [11, 6]]),
      ).toBe('A');
    });

    it('null when leader stuck at 2 (incomplete: 2-2)', () => {
      expect(
        winnerFromSets('A', 'B', [[11, 7], [9, 11], [11, 5], [8, 11]]),
      ).toBeNull();
    });

    it('deuce-heavy 3-2 still resolves correctly', () => {
      expect(
        winnerFromSets('A', 'B', [[12, 10], [10, 12], [13, 11], [9, 11], [15, 13]]),
      ).toBe('A');
    });
  });

  describe('ADVERSARIAL: setsValid', () => {
    it('rejects 3-3 even with extra ties mixed in', () => {
      expect(
        setsValid([[11, 7], [9, 11], [11, 5], [8, 11], [11, 9], [9, 11], [5, 5]]),
      ).toBe(false);
    });

    it('rejects a lone tied set (0 games each)', () => {
      expect(setsValid([[11, 11]])).toBe(false);
    });

    it('accepts deuce-decided 3-0', () => {
      expect(setsValid([[12, 10], [14, 12], [11, 9]])).toBe(true);
    });

    it('rejects 0-3-equivalent over-count for B (1-3 is fine, 1-4 not)', () => {
      // 1-4 for B: B over-counts, invalid.
      expect(
        setsValid([[11, 9], [7, 11], [5, 11], [8, 11], [6, 11]]),
      ).toBe(false);
    });

    it('does not mutate input', () => {
      const sets: SetScore[] = [[11, 7], [11, 9], [11, 5]];
      const snap = JSON.parse(JSON.stringify(sets));
      setsValid(sets);
      expect(sets).toEqual(snap);
    });

    it('rejects undecided 2-2', () => {
      expect(setsValid([[11, 7], [9, 11], [11, 5], [8, 11]])).toBe(false);
    });
  });
});

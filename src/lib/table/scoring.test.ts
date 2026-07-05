import { describe, it, expect } from 'vitest';
import { validateSets, casualWinner } from './scoring';

describe('validateSets', () => {
  it('rejects empty', () => expect(validateSets([])).toBe('no_sets'));
  it('rejects tied set', () => expect(validateSets([[11, 11]])).toBe('set_tied'));
  it('rejects out of range', () => expect(validateSets([[100, 1]])).toBe('bad_points'));
  it('rejects non-integers', () => expect(validateSets([[10.5, 1] as never])).toBe('bad_points'));
  it('rejects tied match (equal set wins)', () => expect(validateSets([[11, 5], [5, 11]])).toBe('match_tied'));
  it('accepts valid match', () => expect(validateSets([[11, 9], [7, 11], [12, 10]])).toBeNull());
});

describe('casualWinner', () => {
  it('a wins 2-1', () => expect(casualWinner('A', 'B', [[11, 9], [7, 11], [11, 5]])).toBe('A'));
  it('b wins 0-1', () => expect(casualWinner('A', 'B', [[3, 11]])).toBe('B'));
});

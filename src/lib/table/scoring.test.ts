import { describe, it, expect } from 'vitest';
import { validateSets, casualWinner, quickSets, quickDefaultLoser } from './scoring';

describe('validateSets', () => {
  it('rejects empty', () => expect(validateSets([])).toBe('no_sets'));
  it('rejects tied set', () => expect(validateSets([[11, 11]])).toBe('set_tied'));
  it('rejects out of range', () => expect(validateSets([[100, 1]])).toBe('bad_points'));
  it('rejects non-integers', () => expect(validateSets([[10.5, 1] as never])).toBe('bad_points'));
  it('rejects tied match (equal set wins)', () => expect(validateSets([[11, 5], [5, 11]])).toBe('match_tied'));
  it('accepts valid match', () => expect(validateSets([[11, 9], [7, 11], [12, 10]])).toBeNull());
  it('rejects fantasy scores (фідбек клубу: 27:34)', () => {
    expect(validateSets([[27, 34]])).toBe('bad_set_score');
    expect(validateSets([[11, 10]])).toBe('bad_set_score'); // при 10:10 — дюс, 11:10 не буває
    expect(validateSets([[13, 10]])).toBe('bad_set_score'); // понад ціль лише з різницею 2
    expect(validateSets([[15, 2]])).toBe('bad_set_score');
  });
  it('accepts legal 21-format and deuces', () => {
    expect(validateSets([[21, 19]])).toBeNull();
    expect(validateSets([[22, 20]])).toBeNull(); // дюс до 21
    expect(validateSets([[21, 5]])).toBeNull();
  });
});

describe('casualWinner', () => {
  it('a wins 2-1', () => expect(casualWinner('A', 'B', [[11, 9], [7, 11], [11, 5]])).toBe('A'));
  it('b wins 0-1', () => expect(casualWinner('A', 'B', [[3, 11]])).toBe('B'));
});

describe('quickSets', () => {
  it('переможець a → [[target, loserPts]]', () => expect(quickSets(true, 11, 9)).toEqual([[11, 9]]));
  it('переможець b → [[loserPts, target]]', () => expect(quickSets(false, 21, 19)).toEqual([[19, 21]]));
  it('дюси одним степпером: понад target-2 переможець бере l+2', () => {
    expect(quickSets(true, 11, 10)).toEqual([[12, 10]]);
    expect(quickSets(true, 11, 15)).toEqual([[17, 15]]);
    expect(quickSets(false, 21, 20)).toEqual([[20, 22]]);
  });
  it('валідний за побудовою навіть на краях (0 очок і дюси)', () => {
    expect(validateSets(quickSets(true, 11, 0))).toBeNull();
    expect(validateSets(quickSets(false, 21, 20))).toBeNull();
    expect(validateSets(quickSets(true, 11, 12))).toBeNull();
  });
  it('орієнтація a:b узгоджена з casualWinner', () => {
    expect(casualWinner('A', 'B', quickSets(true, 11, 7))).toBe('A');
    expect(casualWinner('A', 'B', quickSets(false, 21, 14))).toBe('B');
  });
});

describe('quickDefaultLoser', () => {
  it('9 для гри до 11, 19 — до 21', () => {
    expect(quickDefaultLoser(11)).toBe(9);
    expect(quickDefaultLoser(21)).toBe(19);
  });
});

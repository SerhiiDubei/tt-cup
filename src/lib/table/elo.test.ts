import { describe, it, expect } from 'vitest';
import { eloDelta, leagueOf, LEAGUES } from './elo';

describe('eloDelta', () => {
  it('equal ratings → half of K', () => expect(eloDelta(1000, 1000)).toBe(16));
  it('favorite beats underdog → small gain', () => {
    const d = eloDelta(1200, 1000);
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThan(16);
  });
  it('underdog beats favorite → big gain', () => {
    const d = eloDelta(1000, 1200);
    expect(d).toBeGreaterThan(16);
    expect(d).toBeLessThanOrEqual(31);
  });
  it('never zero even vs much weaker', () => expect(eloDelta(2000, 1000)).toBeGreaterThanOrEqual(1));
  it('symmetry: gains mirror around K/2', () =>
    expect(eloDelta(1000, 1200) + eloDelta(1200, 1000)).toBe(32));
});

describe('leagueOf', () => {
  it('start = НОВАЧОК', () => expect(leagueOf(1000).name).toBe('НОВАЧОК'));
  it('boundaries', () => {
    expect(leagueOf(1049).name).toBe('НОВАЧОК');
    expect(leagueOf(1050).name).toBe('БОЄЦЬ');
    expect(leagueOf(1125).name).toBe('ПРОФІ');
    expect(leagueOf(1200).name).toBe('МАЙСТЕР');
    expect(leagueOf(1300).name).toBe('ЛЕГЕНДА');
  });
  it('leagues ordered high→low', () => {
    for (let i = 1; i < LEAGUES.length; i++) expect(LEAGUES[i].min).toBeLessThan(LEAGUES[i - 1].min);
  });
});

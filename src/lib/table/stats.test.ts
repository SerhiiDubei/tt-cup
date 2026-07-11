import { describe, it, expect } from 'vitest';
import { ratingsAt, positionsAt, rankMoves, formOf, weeklyRows, titlesOf, kyivWeekStart } from './stats';
import type { CasualGame } from './types';

let n = 0;
const g = (
  a: string, b: string, winner: string, endedAt: string,
  opts: Partial<CasualGame> = {}
): CasualGame => ({
  id: `g${n++}`, a, b, winner, status: 'done',
  sets: opts.sets ?? [[11, 5]],
  started_at: opts.started_at ?? new Date(Date.parse(endedAt) - 5 * 60_000).toISOString(),
  ended_at: endedAt,
  delta_a: opts.delta_a !== undefined ? opts.delta_a : (winner === a ? 16 : -16),
  delta_b: opts.delta_b !== undefined ? opts.delta_b : (winner === b ? 16 : -16),
  ...opts,
});

const T = (d: string) => `2026-07-${d}T12:00:00.000Z`;

describe('ratingsAt', () => {
  it('reconstructs ratings chronologically and ignores pre-rating games', () => {
    const games = [
      g('A', 'B', 'A', T('01'), { delta_a: null, delta_b: null }), // до рейтингу
      g('A', 'B', 'A', T('02')),
      g('A', 'C', 'A', T('03')),
    ];
    const r = ratingsAt(games, T('03'));
    expect(r.get('A')).toBe(1032);
    expect(r.get('B')).toBe(984);
    expect(r.get('C')).toBe(984);
    const earlier = ratingsAt(games, T('02'));
    expect(earlier.get('A')).toBe(1016);
    expect(earlier.has('C')).toBe(false);
  });
});

describe('rankMoves', () => {
  it('reports climb after an overtake within 24h', () => {
    const games = [
      g('A', 'B', 'A', '2026-07-01T10:00:00Z'), // A попереду давно (1016 vs 984)
      // B-андердог валить A і бере більше: B 984+20=1004, A 1016-20=996
      g('B', 'A', 'B', '2026-07-05T10:00:00Z', { delta_a: 20, delta_b: -20 }),
    ];
    const moves = rankMoves(games, '2026-07-05T12:00:00Z');
    expect(moves.get('B')).toBe(1);  // був 2-й, став 1-й
    expect(moves.get('A')).toBe(-1);
  });
  it('null for players absent a day ago', () => {
    const games = [g('A', 'B', 'A', '2026-07-05T10:00:00Z')];
    const moves = rankMoves(games, '2026-07-05T12:00:00Z');
    expect(moves.get('A')).toBeNull();
  });
});

describe('formOf', () => {
  it('latest first, capped at n', () => {
    const games = [
      g('A', 'B', 'A', T('01')), g('A', 'B', 'B', T('02')), g('A', 'B', 'A', T('03')),
      g('A', 'B', 'A', T('04')), g('A', 'B', 'B', T('05')), g('A', 'B', 'A', T('06')),
    ];
    expect(formOf(games, 'A', 5)).toEqual(['W', 'L', 'W', 'W', 'L']);
  });
});

describe('weeklyRows', () => {
  it('sums deltas and W-L only inside the window, sorted by gained', () => {
    const games = [
      g('A', 'B', 'A', T('01')),                 // до вікна
      g('A', 'B', 'B', T('08')),                 // у вікні: A -16, B +16
      g('C', 'B', 'B', T('09')),                 // B +16 ще
    ];
    const rows = weeklyRows(games, T('07'));
    expect(rows[0]).toMatchObject({ id: 'B', gained: 32, wins: 2, losses: 0 });
    expect(rows.find((r) => r.id === 'A')).toMatchObject({ gained: -16, wins: 0, losses: 1 });
  });
});

describe('titlesOf', () => {
  it('giant: won vs opponent rated 100+ above at game time', () => {
    const games = [
      // розганяємо B до 1096: 6 перемог по 16
      ...Array.from({ length: 6 }, (_, i) => g('B', 'C', 'B', T(String(i + 1).padStart(2, '0') as never))),
      // тепер A (1000) валить B (1096) — рівно 96, ще НЕ гігант
      g('A', 'B', 'A', T('07')),
    ];
    expect(titlesOf(games, T('08')).get('A') ?? []).not.toContain('giant');
    const more = [
      ...Array.from({ length: 7 }, (_, i) => g('B', 'C', 'B', T(String(i + 1).padStart(2, '0') as never))),
      g('A', 'B', 'A', T('08')), // B на 1112 → різниця 112 → гігант
    ];
    expect(titlesOf(more, T('09')).get('A')).toContain('giant');
  });
  it('comeback: winner lost first two sets', () => {
    const games = [
      g('A', 'B', 'A', T('01'), { sets: [[5, 11], [7, 11], [11, 3], [11, 4], [11, 5]] }),
    ];
    expect(titlesOf(games, T('02')).get('A')).toContain('comeback');
    expect(titlesOf(games, T('02')).get('B') ?? []).not.toContain('comeback');
  });
  it('marathon: most games in 7 days, needs at least 3', () => {
    const games = [
      g('A', 'B', 'A', T('08')), g('A', 'C', 'A', T('09')), g('A', 'B', 'B', T('10')),
      g('C', 'B', 'C', T('10')),
    ];
    const t = titlesOf(games, T('11'));
    expect(t.get('A')).toContain('marathon'); // 3 ігри в A і B... B теж 3!
    expect(t.get('B')).toContain('marathon');
    expect(t.get('C') ?? []).not.toContain('marathon'); // 2 ігри
  });
  it('lightning: fastest win of the week, sub-minute games ignored', () => {
    const games = [
      g('A', 'B', 'A', T('08'), { started_at: `2026-07-08T11:58:59.000Z` }), // 61с ok
      g('C', 'B', 'C', T('09'), { started_at: `2026-07-09T11:59:30.000Z` }), // 30с — артефакт
      g('A', 'C', 'C', T('10'), { started_at: `2026-07-10T11:50:00.000Z` }), // 10 хв
    ];
    const t = titlesOf(games, T('11'));
    expect(t.get('A')).toContain('lightning');
    expect(t.get('C') ?? []).not.toContain('lightning');
  });
});

describe('kyivWeekStart', () => {
  it('sunday evening belongs to the week started previous monday', () => {
    // неділя 2026-07-12 20:00 Києва (17:00 UTC, літній час UTC+3)
    const start = kyivWeekStart('2026-07-12T17:00:00.000Z');
    // понеділок 2026-07-06 00:00 Києва = 2026-07-05T21:00:00Z
    expect(start).toBe('2026-07-05T21:00:00.000Z');
  });
  it('monday morning starts the same day', () => {
    // понеділок 2026-07-06 09:00 Києва = 06:00 UTC
    expect(kyivWeekStart('2026-07-06T06:00:00.000Z')).toBe('2026-07-05T21:00:00.000Z');
  });
});

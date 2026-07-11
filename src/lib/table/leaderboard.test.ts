import { describe, it, expect } from 'vitest';
import { computeLeaderboard } from './leaderboard';
import type { CasualGame } from './types';

const g = (a: string, b: string, winner: string, endedAt: string): CasualGame => ({
  id: endedAt, a, b, sets: [[11, 0]], winner, status: 'done', started_at: endedAt, ended_at: endedAt,
});

describe('computeLeaderboard', () => {
  it('counts wins/losses and sorts by wins', () => {
    const rows = computeLeaderboard([
      g('A', 'B', 'A', '2026-07-01T10:00:00Z'),
      g('A', 'C', 'A', '2026-07-01T11:00:00Z'),
      g('B', 'C', 'C', '2026-07-01T12:00:00Z'),
    ]);
    expect(rows[0]).toMatchObject({ id: 'A', wins: 2, losses: 0 });
    expect(rows.find((r) => r.id === 'B')).toMatchObject({ wins: 0, losses: 2 });
  });
  it('streak = consecutive wins in latest games, resets on loss', () => {
    const rows = computeLeaderboard([
      g('A', 'B', 'B', '2026-07-01T10:00:00Z'),
      g('A', 'B', 'A', '2026-07-01T11:00:00Z'),
      g('A', 'C', 'A', '2026-07-01T12:00:00Z'),
    ]);
    expect(rows.find((r) => r.id === 'A')!.streak).toBe(2);
    expect(rows.find((r) => r.id === 'B')!.streak).toBe(0);
  });
  it('ignores cancelled/active games', () => {
    const rows = computeLeaderboard([{ ...g('A', 'B', 'A', 'x'), status: 'cancelled' }]);
    expect(rows).toEqual([]);
  });
  it('sorts by rating first when ratings differ', () => {
    const rows = computeLeaderboard(
      [
        g('A', 'B', 'A', '2026-07-01T10:00:00Z'),
        g('A', 'B', 'A', '2026-07-01T11:00:00Z'), // A 2-0, B 0-2
      ],
      new Map([['A', 1010], ['B', 1120]]) // але рейтинг B вищий
    );
    expect(rows.map((r) => r.id)).toEqual(['B', 'A']);
    expect(rows[0].rating).toBe(1120);
  });
  it('streaks do not depend on input order (sorts by ended_at internally)', () => {
    // ті самі ігри, що в streak-тесті, але подані в перемішаному порядку
    const rows = computeLeaderboard([
      g('A', 'C', 'A', '2026-07-01T12:00:00Z'),
      g('A', 'B', 'B', '2026-07-01T10:00:00Z'),
      g('A', 'B', 'A', '2026-07-01T11:00:00Z'),
    ]);
    expect(rows.find((r) => r.id === 'A')!.streak).toBe(2);
    expect(rows.find((r) => r.id === 'B')!.streak).toBe(0);
  });
});

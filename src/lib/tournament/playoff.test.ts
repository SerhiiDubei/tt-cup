import { describe, it, expect } from 'vitest';
import {
  seedPlayoff,
  advancePlayoff,
  champion,
  bronze,
  SEED_PAIRS,
} from './playoff';
import type { Player, Match, SetScore } from './types';

// --- test helpers -----------------------------------------------------------

function mkPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: overrides.name ?? id,
    nickname: overrides.nickname ?? id,
    hero: overrides.hero ?? {
      color: '#FF2E88',
      shape: 'circle',
      emblem: 'x',
      style: 'attacker',
    },
    motto: overrides.motto,
    seed: overrides.seed ?? 0,
  };
}

let matchCounter = 0;
function mkMatch(overrides: Partial<Match> = {}): Match {
  matchCounter += 1;
  return {
    id: overrides.id ?? `m${matchCounter}`,
    stage: overrides.stage ?? 'playoff',
    round: overrides.round ?? 'QF',
    slot: overrides.slot ?? 0,
    a: overrides.a ?? 'a',
    b: overrides.b ?? 'b',
    seed_a: overrides.seed_a ?? null,
    seed_b: overrides.seed_b ?? null,
    sets: overrides.sets ?? [],
    winner: overrides.winner ?? null,
    status: overrides.status ?? 'pending',
  };
}

const SWEEP: SetScore[] = [[11, 0], [11, 0], [11, 0]];

/**
 * Eight players whose seed numbers (1..8) match the order they should be
 * placed into the playoff. `computeStandings` ranks by name when nothing else
 * differs, so ids are named so that alphabetical order == seed order, and seed
 * field is set explicitly too.
 */
function eightPlayers(): Player[] {
  return [
    mkPlayer('p1', { name: 'A', seed: 1 }),
    mkPlayer('p2', { name: 'B', seed: 2 }),
    mkPlayer('p3', { name: 'C', seed: 3 }),
    mkPlayer('p4', { name: 'D', seed: 4 }),
    mkPlayer('p5', { name: 'E', seed: 5 }),
    mkPlayer('p6', { name: 'F', seed: 6 }),
    mkPlayer('p7', { name: 'G', seed: 7 }),
    mkPlayer('p8', { name: 'H', seed: 8 }),
  ];
}

/** Mark a match reported with `winnerId` taking a 3-0 sweep. */
function won(m: Match, winnerId: string): Match {
  return { ...m, sets: SWEEP, winner: winnerId, status: 'reported' };
}

// ---------------------------------------------------------------------------

describe('SEED_PAIRS', () => {
  it('is the standard top-8 bracket: 1-8, 4-5, 2-7, 3-6', () => {
    // Stored as 1-based seed numbers (spec §10).
    expect(SEED_PAIRS).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
  });
});

describe('seedPlayoff', () => {
  // plan Task 2.4: seedPlayoff -> 4 QF, pairing 1-8,4-5,2-7,3-6 with seed_a/seed_b
  describe('plan core case (8 players, no matches yet -> rank by seed)', () => {
    const players = eightPlayers();
    // No swiss matches: standings fall back to seed/name order, which we
    // arranged to equal 1..8.
    const qf = seedPlayoff(players, []);

    it('creates exactly 4 quarter-final matches', () => {
      expect(qf).toHaveLength(4);
    });

    it('marks every match as a pending playoff QF', () => {
      qf.forEach((m) => {
        expect(m.stage).toBe('playoff');
        expect(m.round).toBe('QF');
        expect(m.status).toBe('pending');
        expect(m.winner).toBeNull();
        expect(m.sets).toEqual([]);
      });
    });

    it('pairs by seed 1-8, 4-5, 2-7, 3-6', () => {
      // Map each match to its pair of seeds.
      const pairs = qf.map((m) => [m.seed_a, m.seed_b]);
      expect(pairs).toEqual([
        [1, 8],
        [4, 5],
        [2, 7],
        [3, 6],
      ]);
    });

    it('places the right player ids on each side', () => {
      // p1..p8 have seeds 1..8.
      expect(qf[0].a).toBe('p1');
      expect(qf[0].b).toBe('p8');
      expect(qf[1].a).toBe('p4');
      expect(qf[1].b).toBe('p5');
      expect(qf[2].a).toBe('p2');
      expect(qf[2].b).toBe('p7');
      expect(qf[3].a).toBe('p3');
      expect(qf[3].b).toBe('p6');
    });

    it('assigns sequential slots 0..3', () => {
      expect(qf.map((m) => m.slot)).toEqual([0, 1, 2, 3]);
    });

    it('never produces a bye (b is always set) in a top-8 bracket', () => {
      qf.forEach((m) => expect(m.b).not.toBeNull());
    });
  });

  // spec §10: top-8 are chosen *by standings*, not raw seed field.
  describe('selects the top 8 by standings, in standings order', () => {
    // 10 players; standings determined by reported swiss results. The two
    // lowest finishers must be excluded; the rest seeded 1..8 by finish.
    const players = [
      mkPlayer('w1', { name: 'A' }),
      mkPlayer('w2', { name: 'B' }),
      mkPlayer('w3', { name: 'C' }),
      mkPlayer('w4', { name: 'D' }),
      mkPlayer('l1', { name: 'Y' }),
      mkPlayer('l2', { name: 'Z' }),
      mkPlayer('m1', { name: 'E' }),
      mkPlayer('m2', { name: 'F' }),
      mkPlayer('m3', { name: 'G' }),
      mkPlayer('m4', { name: 'H' }),
    ];
    // Point design (1 pt per win) — clear, no point ties at the cut line:
    //   w1: 3 pts, w2: 3, w3: 2, w4: 2, m1: 2, m2: 1, m3: 1, m4: 1
    //   l1: 0, l2: 0  <- strictly the two lowest, so they are the excluded pair.
    // Every win comes against one of l1/l2 (their losses), keeping their points
    // at zero while feeding wins to everyone above the cut line.
    const matches: Match[] = [
      // l1 loses 5 times -> 0 pts; donates wins to w1,w2,w3,w4,m1.
      won(mkMatch({ stage: 'swiss', round: '1', a: 'w1', b: 'l1' }), 'w1'),
      won(mkMatch({ stage: 'swiss', round: '2', a: 'w2', b: 'l1' }), 'w2'),
      won(mkMatch({ stage: 'swiss', round: '3', a: 'w3', b: 'l1' }), 'w3'),
      won(mkMatch({ stage: 'swiss', round: '4', a: 'w4', b: 'l1' }), 'w4'),
      won(mkMatch({ stage: 'swiss', round: '5', a: 'm1', b: 'l1' }), 'm1'),
      // l2 loses 5 times -> 0 pts; donates wins to w1,w2,w3,w4,m1.
      won(mkMatch({ stage: 'swiss', round: '1', a: 'w2', b: 'l2' }), 'w2'),
      won(mkMatch({ stage: 'swiss', round: '2', a: 'w1', b: 'l2' }), 'w1'),
      won(mkMatch({ stage: 'swiss', round: '3', a: 'w4', b: 'l2' }), 'w4'),
      won(mkMatch({ stage: 'swiss', round: '4', a: 'w3', b: 'l2' }), 'w3'),
      won(mkMatch({ stage: 'swiss', round: '5', a: 'm1', b: 'l2' }), 'm1'),
      // Extra wins for w1, w2 to make them the clear top 2 (3 pts each).
      won(mkMatch({ stage: 'swiss', round: '6', a: 'w1', b: 'm2' }), 'w1'),
      won(mkMatch({ stage: 'swiss', round: '6', a: 'w2', b: 'm3' }), 'w2'),
      // m2, m3, m4 each take exactly one win (1 pt) over each other / a w-tier.
      won(mkMatch({ stage: 'swiss', round: '7', a: 'm2', b: 'm4' }), 'm2'),
      won(mkMatch({ stage: 'swiss', round: '7', a: 'm3', b: 'w4' }), 'm3'),
      won(mkMatch({ stage: 'swiss', round: '8', a: 'm4', b: 'w3' }), 'm4'),
    ];

    it('produces 4 QF matches from 10 players (top 8 only)', () => {
      const qf = seedPlayoff(players, matches);
      expect(qf).toHaveLength(4);
    });

    it('excludes the two lowest finishers (l1, l2)', () => {
      const qf = seedPlayoff(players, matches);
      const ids = qf.flatMap((m) => [m.a, m.b]);
      expect(ids).not.toContain('l1');
      expect(ids).not.toContain('l2');
      expect(ids).toHaveLength(8);
      expect(new Set(ids).size).toBe(8); // all distinct
    });

    it('seeds the #1 standing against the #8 standing', () => {
      const qf = seedPlayoff(players, matches);
      // seed_a/seed_b are bracket seeds 1..8 by finishing order.
      expect(qf[0].seed_a).toBe(1);
      expect(qf[0].seed_b).toBe(8);
      // The #1 finisher overall is a 2-point winner.
      const top = ['w1', 'w2', 'w3', 'w4'];
      expect(top).toContain(qf[0].a);
    });
  });
});

describe('advancePlayoff', () => {
  const players = eightPlayers();

  // Build a completed QF round: lower seed (a side) always wins.
  function completedQF(): Match[] {
    const qf = seedPlayoff(players, []);
    return qf.map((m) => won(m, m.a));
  }

  describe('QF -> SF', () => {
    it('produces 2 semi-final matches from the 4 QF winners', () => {
      const next = advancePlayoff(players, completedQF());
      const sf = next.filter((m) => m.round === 'SF');
      expect(sf).toHaveLength(2);
      expect(next).toHaveLength(2);
    });

    it('semi-finals are pending playoff matches with slots 0,1', () => {
      const next = advancePlayoff(players, completedQF());
      const sf = next.filter((m) => m.round === 'SF');
      sf.forEach((m) => {
        expect(m.stage).toBe('playoff');
        expect(m.status).toBe('pending');
        expect(m.winner).toBeNull();
      });
      expect(sf.map((m) => m.slot)).toEqual([0, 1]);
    });

    it('pairs QF winners by bracket: (QF0 vs QF1) and (QF2 vs QF3)', () => {
      // a-side always wins -> winners are p1, p4, p2, p3 (in slot order).
      const next = advancePlayoff(players, completedQF());
      const sf = next.filter((m) => m.round === 'SF');
      expect([sf[0].a, sf[0].b]).toEqual(['p1', 'p4']);
      expect([sf[1].a, sf[1].b]).toEqual(['p2', 'p3']);
    });
  });

  describe('SF -> F + BR', () => {
    // QF complete (winners p1,p4,p2,p3), then SF complete.
    function afterSF(): Match[] {
      const qf = completedQF();
      const sf = advancePlayoff(players, qf).filter((m) => m.round === 'SF');
      // SF0: p1 vs p4 -> p1 wins; SF1: p2 vs p3 -> p2 wins.
      // losers: p4, p3.
      const sfDone = [won(sf[0], sf[0].a), won(sf[1], sf[1].a)];
      return [...qf, ...sfDone];
    }

    it('produces exactly a Final and a Bronze match', () => {
      const next = advancePlayoff(players, afterSF());
      const rounds = next.map((m) => m.round).sort();
      expect(rounds).toEqual(['BR', 'F']);
      expect(next).toHaveLength(2);
    });

    it('Final is the two SF winners', () => {
      const next = advancePlayoff(players, afterSF());
      const f = next.find((m) => m.round === 'F')!;
      expect([f.a, f.b]).toEqual(['p1', 'p2']);
    });

    it('Bronze (BR) is the two SF losers (spec §10)', () => {
      const next = advancePlayoff(players, afterSF());
      const br = next.find((m) => m.round === 'BR')!;
      // SF losers were p4 (from SF0) and p3 (from SF1).
      expect([br.a, br.b]).toEqual(['p4', 'p3']);
    });

    it('Final and Bronze are pending playoff matches', () => {
      const next = advancePlayoff(players, afterSF());
      next.forEach((m) => {
        expect(m.stage).toBe('playoff');
        expect(m.status).toBe('pending');
        expect(m.winner).toBeNull();
        expect(m.sets).toEqual([]);
      });
    });
  });

  describe('after F + BR are decided -> no more rounds', () => {
    it('returns an empty array once the final round exists', () => {
      const qf = completedQF();
      const sf = advancePlayoff(players, qf).filter((m) => m.round === 'SF');
      const sfDone = [won(sf[0], sf[0].a), won(sf[1], sf[1].a)];
      const fbr = advancePlayoff(players, [...qf, ...sfDone]);
      const fbrDone = fbr.map((m) => won(m, m.a));
      const next = advancePlayoff(players, [...qf, ...sfDone, ...fbrDone]);
      expect(next).toEqual([]);
    });
  });

  describe('does not advance an incomplete round', () => {
    it('returns [] (no new matches) when a QF match is still pending', () => {
      const qf = seedPlayoff(players, []);
      // Report only 3 of 4 QF matches.
      const partial = qf.map((m, i) => (i < 3 ? won(m, m.a) : m));
      const next = advancePlayoff(players, partial);
      // Current round (QF) not complete -> nothing new generated.
      expect(next).toEqual([]);
    });
  });
});

describe('champion', () => {
  const players = eightPlayers();

  it('returns the winner of the Final', () => {
    const matches: Match[] = [
      won(mkMatch({ round: 'F', a: 'p1', b: 'p2' }), 'p2'),
      won(mkMatch({ round: 'BR', a: 'p3', b: 'p4' }), 'p3'),
    ];
    expect(champion(matches)).toBe('p2');
  });

  it('returns null when the Final is not yet reported', () => {
    const matches: Match[] = [
      mkMatch({ round: 'F', a: 'p1', b: 'p2', status: 'pending' }),
    ];
    expect(champion(matches)).toBeNull();
  });

  it('returns null when there is no Final match at all', () => {
    const matches: Match[] = [won(mkMatch({ round: 'QF', a: 'p1', b: 'p8' }), 'p1')];
    expect(champion(matches)).toBeNull();
  });

  it('ignores swiss matches when looking for the Final', () => {
    const matches: Match[] = [
      won(mkMatch({ stage: 'swiss', round: '1', a: 'p1', b: 'p2' }), 'p1'),
    ];
    expect(champion(matches)).toBeNull();
  });
});

describe('bronze', () => {
  it('returns the winner of the Bronze (BR) match', () => {
    const matches: Match[] = [
      won(mkMatch({ round: 'F', a: 'p1', b: 'p2' }), 'p1'),
      won(mkMatch({ round: 'BR', a: 'p3', b: 'p4' }), 'p4'),
    ];
    expect(bronze(matches)).toBe('p4');
  });

  it('returns null when the Bronze match is not yet reported', () => {
    const matches: Match[] = [
      mkMatch({ round: 'BR', a: 'p3', b: 'p4', status: 'pending' }),
    ];
    expect(bronze(matches)).toBeNull();
  });

  it('returns null when there is no Bronze match', () => {
    expect(bronze([])).toBeNull();
  });
});

// ===========================================================================
// ADVERSARIAL PROBES  (hunting for real defects)
// ===========================================================================

describe('ADVERSARIAL: input immutability', () => {
  it('seedPlayoff does not mutate the players or matches arrays', () => {
    const players = eightPlayers();
    const matches: Match[] = [];
    const playersCopy = JSON.parse(JSON.stringify(players));
    const matchesCopy = JSON.parse(JSON.stringify(matches));
    Object.freeze(players);
    Object.freeze(matches);
    seedPlayoff(players, matches);
    expect(players).toEqual(playersCopy);
    expect(matches).toEqual(matchesCopy);
  });

  it('advancePlayoff does not mutate the matches array or its match objects', () => {
    const players = eightPlayers();
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const snapshot = JSON.parse(JSON.stringify(qf));
    // Deep-freeze every match object so any in-place write throws.
    qf.forEach((m) => {
      Object.freeze(m);
      Object.freeze(m.sets);
    });
    Object.freeze(qf);
    const next = advancePlayoff(players, qf);
    expect(next).toHaveLength(2);
    // Inputs unchanged.
    expect(qf).toEqual(snapshot);
  });
});

describe('ADVERSARIAL: seedPlayoff boundaries', () => {
  it('returns [] for exactly 7 players (one short of the bracket)', () => {
    const players = eightPlayers().slice(0, 7);
    expect(seedPlayoff(players, [])).toEqual([]);
  });

  it('produces a full bracket for exactly 8 players', () => {
    const players = eightPlayers();
    expect(seedPlayoff(players, [])).toHaveLength(4);
  });

  it('returns [] for 0 players', () => {
    expect(seedPlayoff([], [])).toEqual([]);
  });

  it('ignores extra players beyond the top 8 even when 9th would alter pairing', () => {
    // 9 players, all tied at 0 pts -> name decides order. Names chosen so the
    // 9th ("I") is strictly last and must be excluded.
    const players = [
      mkPlayer('p1', { name: 'A', seed: 1 }),
      mkPlayer('p2', { name: 'B', seed: 2 }),
      mkPlayer('p3', { name: 'C', seed: 3 }),
      mkPlayer('p4', { name: 'D', seed: 4 }),
      mkPlayer('p5', { name: 'E', seed: 5 }),
      mkPlayer('p6', { name: 'F', seed: 6 }),
      mkPlayer('p7', { name: 'G', seed: 7 }),
      mkPlayer('p8', { name: 'H', seed: 8 }),
      mkPlayer('p9', { name: 'I', seed: 9 }),
    ];
    const qf = seedPlayoff(players, []);
    const ids = qf.flatMap((m) => [m.a, m.b]);
    expect(ids).not.toContain('p9');
    expect(qf).toHaveLength(4);
  });
});

describe('ADVERSARIAL: advancePlayoff is order-insensitive and idempotent', () => {
  const players = eightPlayers();

  it('builds correct SF even when QF matches are passed in scrambled slot order', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    // Shuffle: reverse the array so slots arrive 3,2,1,0.
    const scrambled = [...qf].reverse();
    const next = advancePlayoff(players, scrambled);
    const sf = next.filter((m) => m.round === 'SF');
    // Must still pair (QF0w vs QF1w) and (QF2w vs QF3w) by SLOT, not array order.
    expect([sf[0].a, sf[0].b]).toEqual(['p1', 'p4']);
    expect([sf[1].a, sf[1].b]).toEqual(['p2', 'p3']);
  });

  it('called twice on a QF-complete state yields identical SF (no duplication when re-fed)', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const first = advancePlayoff(players, qf);
    // Simulate the SF being persisted, then advance again: must NOT re-create SF
    // (SF now exists but is unreported -> nothing new).
    const withSf = [...qf, ...first];
    const second = advancePlayoff(players, withSf);
    expect(second).toEqual([]);
  });

  it('does not regenerate F/BR when called again after F+BR exist but are unreported', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const sf = advancePlayoff(players, qf).filter((m) => m.round === 'SF');
    const sfDone = [won(sf[0], sf[0].a), won(sf[1], sf[1].a)];
    const fbr = advancePlayoff(players, [...qf, ...sfDone]);
    expect(fbr).toHaveLength(2);
    // F+BR exist but pending -> a second advance must produce nothing.
    const again = advancePlayoff(players, [...qf, ...sfDone, ...fbr]);
    expect(again).toEqual([]);
  });
});

describe('ADVERSARIAL: loser/winner identification edge cases', () => {
  const players = eightPlayers();

  it('correctly identifies SF loser when the b-side wins (not just a-side)', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const sf = advancePlayoff(players, qf).filter((m) => m.round === 'SF');
    // SF0: p1 vs p4 -> b-side p4 wins. SF1: p2 vs p3 -> b-side p3 wins.
    const sfDone = [won(sf[0], sf[0].b!), won(sf[1], sf[1].b!)];
    const fbr = advancePlayoff(players, [...qf, ...sfDone]);
    const f = fbr.find((m) => m.round === 'F')!;
    const br = fbr.find((m) => m.round === 'BR')!;
    // Winners p4, p3 -> Final. Losers p1, p2 -> Bronze.
    expect([f.a, f.b]).toEqual(['p4', 'p3']);
    expect([br.a, br.b]).toEqual(['p1', 'p2']);
  });

  it('champion is the FINAL winner regardless of who is on side a/b', () => {
    const matches: Match[] = [
      won(mkMatch({ round: 'F', a: 'p1', b: 'p2' }), 'p2'),
    ];
    expect(champion(matches)).toBe('p2');
  });

  it('bronze ignores a stray Final and reads only the BR match', () => {
    const matches: Match[] = [
      won(mkMatch({ round: 'F', a: 'p1', b: 'p2' }), 'p1'),
      won(mkMatch({ round: 'BR', a: 'p7', b: 'p8' }), 'p8'),
    ];
    expect(bronze(matches)).toBe('p8');
    expect(champion(matches)).toBe('p1');
  });
});

describe('ADVERSARIAL: advancePlayoff does not skip stages', () => {
  const players = eightPlayers();

  it('with reported QF AND pre-existing complete SF, only F+BR are produced (not new SF)', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const sf = advancePlayoff(players, qf).filter((m) => m.round === 'SF');
    const sfDone = [won(sf[0], sf[0].a), won(sf[1], sf[1].a)];
    const next = advancePlayoff(players, [...qf, ...sfDone]);
    expect(next.some((m) => m.round === 'SF')).toBe(false);
    expect(next.map((m) => m.round).sort()).toEqual(['BR', 'F']);
  });

  it('returns [] when SF is complete but one SF match lacks a winner field', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const sf = advancePlayoff(players, qf).filter((m) => m.round === 'SF');
    // Mark reported but with winner null (corrupt) -> must NOT advance.
    const corrupt = [
      { ...sf[0], status: 'reported' as const, winner: null },
      won(sf[1], sf[1].a),
    ];
    const next = advancePlayoff(players, [...qf, ...corrupt]);
    expect(next).toEqual([]);
  });

  it('does not advance QF->SF when a QF match is reported but winner is null', () => {
    const qf = seedPlayoff(players, []);
    const corrupt = qf.map((m, i) =>
      i === 0
        ? { ...m, status: 'reported' as const, winner: null }
        : won(m, m.a),
    );
    expect(advancePlayoff(players, corrupt)).toEqual([]);
  });
});

describe('ADVERSARIAL: bracket seed follows STANDINGS, not raw seed field', () => {
  it('assigns bracket seed 1 to the points leader even if their seed field is 8', () => {
    // Raw seed fields are deliberately inverted vs. their results.
    const players = [
      mkPlayer('leader', { name: 'Z', seed: 8 }), // will be #1 by points
      mkPlayer('p2', { name: 'B', seed: 1 }),
      mkPlayer('p3', { name: 'C', seed: 2 }),
      mkPlayer('p4', { name: 'D', seed: 3 }),
      mkPlayer('p5', { name: 'E', seed: 4 }),
      mkPlayer('p6', { name: 'F', seed: 5 }),
      mkPlayer('p7', { name: 'G', seed: 6 }),
      mkPlayer('p8', { name: 'H', seed: 7 }),
    ];
    // Give 'leader' a clear win so it leads standings; everyone else 0 pts and
    // ordered by name (B<C<D<E<F<G<H).
    const matches: Match[] = [
      won(mkMatch({ stage: 'swiss', round: '1', a: 'leader', b: 'p2' }), 'leader'),
    ];
    const qf = seedPlayoff(players, matches);
    // Bracket seed 1 (qf[0].a, seed_a===1) must be the points leader.
    expect(qf[0].seed_a).toBe(1);
    expect(qf[0].a).toBe('leader');
    // Bracket seed 8 sits opposite seed 1 in QF0.
    expect(qf[0].seed_b).toBe(8);
  });
});

describe('ADVERSARIAL: malformed SF (duplicate slot) does not falsely advance', () => {
  const players = eightPlayers();

  it('two reported SF matches sharing slot 0 still create F+BR only if both winners exist', () => {
    // Both have slot 0 (corrupt persistence). length===2 && allReported true.
    // This documents behaviour: the function uses positional [sf0, sf1] after
    // sorting by slot; with equal slots, order is whatever the stable sort
    // yields. F/BR are still built from the two winners/losers present.
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const sfA = won(
      mkMatch({ round: 'SF', slot: 0, a: 'p1', b: 'p4' }),
      'p1',
    );
    const sfB = won(
      mkMatch({ round: 'SF', slot: 0, a: 'p2', b: 'p3' }),
      'p2',
    );
    const next = advancePlayoff(players, [...qf, sfA, sfB]);
    expect(next.map((m) => m.round).sort()).toEqual(['BR', 'F']);
    const f = next.find((m) => m.round === 'F')!;
    const br = next.find((m) => m.round === 'BR')!;
    // Winners p1,p2 in Final; losers p4,p3 in Bronze (set-membership check,
    // order is sort-dependent for equal slots).
    expect(new Set([f.a, f.b])).toEqual(new Set(['p1', 'p2']));
    expect(new Set([br.a, br.b])).toEqual(new Set(['p4', 'p3']));
  });
});

describe('ADVERSARIAL: cross-contamination with swiss matches', () => {
  const players = eightPlayers();

  it('advancePlayoff ignores swiss matches entirely', () => {
    const qf = seedPlayoff(players, []).map((m) => won(m, m.a));
    const swissNoise: Match[] = [
      won(mkMatch({ stage: 'swiss', round: 'QF', a: 'p1', b: 'p2' }), 'p1'),
      won(mkMatch({ stage: 'swiss', round: 'SF', a: 'p3', b: 'p4' }), 'p3'),
    ];
    const next = advancePlayoff(players, [...qf, ...swissNoise]);
    // Swiss "QF"/"SF" must not be treated as playoff rounds.
    const sf = next.filter((m) => m.round === 'SF');
    expect(sf).toHaveLength(2);
    expect([sf[0].a, sf[0].b]).toEqual(['p1', 'p4']);
  });
});

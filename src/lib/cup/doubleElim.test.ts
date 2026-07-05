import { describe, it, expect } from 'vitest';
import { createBracket, reportResult, resetResult } from './doubleElim';
import type { CupPlayer, CupState, CupMatch } from './types';

/**
 * Inlined copy of {@link import('./players').mulberry32} — kept local so this
 * test does not pull in players.ts, which imports the `@/`-aliased avatar/config
 * modules that the vitest config does not resolve.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal CupPlayer (avatar/style content irrelevant to the engine). */
function makePlayers(n: number): CupPlayer[] {
  const players: CupPlayer[] = [];
  for (let i = 1; i <= n; i++) {
    players.push({
      id: `p${i}`,
      name: `Player ${i}`,
      traits: {
        gender: 'm',
        skin: 's1',
        hair: 'h1',
        hairColor: 'c1',
        outfit: 'o1',
        accessory: 'a1',
      },
      style: 'attacker',
    });
  }
  return players;
}

/** Deep-freeze an object so accidental mutation throws in tests. */
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) deepFreeze(v);
    Object.freeze(obj);
  }
  return obj;
}

/** A pending match that is actually playable (both sides filled). */
function playable(state: CupState): CupMatch[] {
  return state.matches.filter(
    (m) => m.status === 'pending' && m.a != null && m.b != null,
  );
}

type Decider = (m: CupMatch, rand: () => number, seedRank: Map<string, number>) => 0 | 1;

/** Random decider (deterministic via injected rand). */
const randomDecider: Decider = (_m, rand) => (rand() < 0.5 ? 0 : 1);

/** Higher seed (lower rank number) always wins. */
const higherSeedDecider: Decider = (m, _rand, seedRank) => {
  const ra = seedRank.get(m.a!)!;
  const rb = seedRank.get(m.b!)!;
  return ra < rb ? 0 : 1; // 0 => a wins, 1 => b wins
};

/**
 * Simulate a full tournament to completion. Returns the final state.
 * Throws if it cannot make progress (engine deadlock) within a step budget.
 */
function simulate(
  initial: CupState,
  decide: Decider,
  rand: () => number,
  seedRank: Map<string, number>,
): { state: CupState; steps: number } {
  let state = initial;
  let steps = 0;
  const budget = 10000;
  while (state.phase !== 'done') {
    const open = playable(state);
    if (open.length === 0) {
      throw new Error(
        `Deadlock: no playable match but phase=${state.phase}. ` +
          `Pending-with-both: ${state.matches.filter((m) => m.status === 'pending').map((m) => `${m.id}[${m.a},${m.b}]`).join(', ')}`,
      );
    }
    const m = open[0];
    const who = decide(m, rand, seedRank);
    // winner gets a higher score
    const sa = who === 0 ? 3 : 1;
    const sb = who === 0 ? 1 : 3;
    state = reportResult(state, m.id, sa, sb);
    steps++;
    if (steps > budget) throw new Error('step budget exceeded');
  }
  return { state, steps };
}

/** Count reported matches in which `pid` is the LOSER. */
function lossCount(state: CupState, pid: string): number {
  let c = 0;
  for (const m of state.matches) {
    if (m.status !== 'reported' || m.winner == null) continue;
    if (m.a == null || m.b == null) continue; // bye → no real loser
    const loser = m.winner === m.a ? m.b : m.a;
    if (loser === pid) c++;
  }
  return c;
}

/** Assert all post-completion invariants. */
function assertInvariants(state: CupState, players: CupPlayer[]) {
  // exactly one champion, non-null
  expect(state.championId).not.toBeNull();
  expect(state.phase).toBe('done');

  // runnerUp set and != champion
  expect(state.runnerUpId).not.toBeNull();
  expect(state.runnerUpId).not.toBe(state.championId);

  const champ = state.championId!;
  const runner = state.runnerUpId!;

  // Loss accounting.
  for (const p of players) {
    const losses = lossCount(state, p.id);
    if (p.id === champ) {
      expect(losses, `champion ${p.id} losses`).toBeLessThanOrEqual(1);
    } else if (p.id === runner) {
      expect(losses, `runnerUp ${p.id} losses`).toBeGreaterThanOrEqual(1);
      expect(losses, `runnerUp ${p.id} losses`).toBeLessThanOrEqual(2);
    } else {
      // every other player is eliminated with exactly 2 losses
      expect(losses, `eliminated ${p.id} losses`).toBe(2);
    }
  }

  // No pending match left with both sides non-null.
  const stuck = state.matches.filter(
    (m) => m.status === 'pending' && m.a != null && m.b != null,
  );
  expect(stuck, `stuck matches: ${stuck.map((m) => m.id).join(',')}`).toHaveLength(0);

  // No player double-booked across simultaneous pending live matches.
  // (At completion there are none, but we also check during simulation.)
  const seen = new Set<string>();
  for (const m of playable(state)) {
    for (const pid of [m.a, m.b]) {
      if (pid == null) continue;
      expect(seen.has(pid), `double-booked ${pid}`).toBe(false);
      seen.add(pid);
    }
  }
}

/** Map player id -> seed rank (0-based) given seed-ordered players. */
function seedRankOf(players: CupPlayer[]): Map<string, number> {
  const m = new Map<string, number>();
  players.forEach((p, i) => m.set(p.id, i));
  return m;
}

// During simulation, verify nobody is double-booked at any step.
function assertNoDoubleBookingDuring(
  initial: CupState,
  decide: Decider,
  rand: () => number,
  seedRank: Map<string, number>,
) {
  let state = initial;
  const budget = 10000;
  let steps = 0;
  while (state.phase !== 'done') {
    const open = playable(state);
    const seen = new Set<string>();
    for (const m of open) {
      for (const pid of [m.a, m.b]) {
        if (pid == null) continue;
        expect(seen.has(pid), `double-booked ${pid} at step ${steps}`).toBe(false);
        seen.add(pid);
      }
    }
    if (open.length === 0) break;
    const m = open[0];
    const who = decide(m, rand, seedRank);
    state = reportResult(state, m.id, who === 0 ? 3 : 1, who === 0 ? 1 : 3);
    steps++;
    if (steps > budget) throw new Error('budget');
  }
}

// ---------------------------------------------------------------------------
// Full-tournament invariant tests
// ---------------------------------------------------------------------------

const SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 11, 16];

describe('double elimination — full tournaments', () => {
  for (const N of SIZES) {
    it(`N=${N}: completes with valid invariants (random decider)`, () => {
      const players = makePlayers(N);
      const seedRank = seedRankOf(players);
      const state = createBracket(players, 1000, `Cup ${N}`);
      const rand = mulberry32(0xc0ffee + N);
      const { state: final } = simulate(state, randomDecider, rand, seedRank);
      assertInvariants(final, players);
    });

    it(`N=${N}: completes with valid invariants (higher-seed-wins)`, () => {
      const players = makePlayers(N);
      const seedRank = seedRankOf(players);
      const state = createBracket(players, 2000, `Cup ${N}`);
      const rand = mulberry32(1);
      const { state: final } = simulate(state, higherSeedDecider, rand, seedRank);
      assertInvariants(final, players);
      // With higher seed always winning, the #1 seed must be champion.
      expect(final.championId).toBe('p1');
    });

    it(`N=${N}: nobody double-booked at any step`, () => {
      const players = makePlayers(N);
      const seedRank = seedRankOf(players);
      const state = createBracket(players, 3000, `Cup ${N}`);
      const rand = mulberry32(777 + N);
      assertNoDoubleBookingDuring(state, randomDecider, rand, seedRank);
    });

    it(`N=${N}: multiple random seeds all complete`, () => {
      const players = makePlayers(N);
      const seedRank = seedRankOf(players);
      for (let seed = 0; seed < 25; seed++) {
        const state = createBracket(players, 4000 + seed, `Cup ${N}`);
        const rand = mulberry32(seed * 2654435761);
        const { state: final } = simulate(state, randomDecider, rand, seedRank);
        assertInvariants(final, players);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Immutability
// ---------------------------------------------------------------------------

describe('purity / immutability', () => {
  it('createBracket does not mutate the input players array', () => {
    const players = makePlayers(7);
    deepFreeze(players);
    // Should not throw.
    expect(() => createBracket(players, 1, 'X')).not.toThrow();
  });

  it('reportResult does not mutate the input state', () => {
    const players = makePlayers(8);
    const state = createBracket(players, 1, 'X');
    deepFreeze(state);
    const open = playable(state);
    expect(open.length).toBeGreaterThan(0);
    const before = JSON.stringify(state);
    const next = reportResult(state, open[0].id, 3, 1);
    // input unchanged
    expect(JSON.stringify(state)).toBe(before);
    // returned state is a different object
    expect(next).not.toBe(state);
    expect(next.matches).not.toBe(state.matches);
  });
});

// ---------------------------------------------------------------------------
// Structural unit tests
// ---------------------------------------------------------------------------

describe('createBracket structure (N=4)', () => {
  const players = makePlayers(4);
  const state = createBracket(players, 1, 'Four');

  it('produces 2 WB round-1 matches, 1 WB final', () => {
    const wb1 = state.matches.filter((m) => m.bracket === 'W' && m.round === 1);
    const wb2 = state.matches.filter((m) => m.bracket === 'W' && m.round === 2);
    expect(wb1).toHaveLength(2);
    expect(wb2).toHaveLength(1);
    expect(wb2[0].label).toBe('Фінал В');
  });

  it('produces an LB with 2 rounds', () => {
    const lbRounds = new Set(
      state.matches.filter((m) => m.bracket === 'L').map((m) => m.round),
    );
    expect(lbRounds.size).toBe(2);
    // LB round 1 has 1 match, LB round 2 (final) has 1 match.
    const lb1 = state.matches.filter((m) => m.bracket === 'L' && m.round === 1);
    const lb2 = state.matches.filter((m) => m.bracket === 'L' && m.round === 2);
    expect(lb1).toHaveLength(1);
    expect(lb2).toHaveLength(1);
  });

  it('produces exactly 1 grand final', () => {
    const gf = state.matches.filter((m) => m.bracket === 'GF');
    expect(gf).toHaveLength(1);
    expect(gf[0].label).toBe('ГРАНД-ФІНАЛ');
  });

  it('every winTo/loseTo target exists; GF has null routing', () => {
    const ids = new Set(state.matches.map((m) => m.id));
    for (const m of state.matches) {
      if (m.winTo) expect(ids.has(m.winTo.matchId)).toBe(true);
      if (m.loseTo) expect(ids.has(m.loseTo.matchId)).toBe(true);
    }
    const gf = state.matches.find((m) => m.bracket === 'GF')!;
    expect(gf.winTo).toBeNull();
    expect(gf.loseTo).toBeNull();
  });

  it('GF starts with WB champ slot (a) and LB champ slot (b)', () => {
    // WB final winner routes to GF side a
    const wbFinal = state.matches.find((m) => m.bracket === 'W' && m.round === 2)!;
    expect(wbFinal.winTo).toEqual({ matchId: 'GF-1-0', side: 'a' });
    // LB final winner routes to GF side b
    const lbFinal = state.matches.find((m) => m.bracket === 'L' && m.round === 2)!;
    expect(lbFinal.winTo).toEqual({ matchId: 'GF-1-0', side: 'b' });
  });

  it('all 4 players appear in WB round 1 (no byes for N=4)', () => {
    const wb1 = state.matches.filter((m) => m.bracket === 'W' && m.round === 1);
    const seated = new Set<string>();
    for (const m of wb1) {
      expect(m.a).not.toBeNull();
      expect(m.b).not.toBeNull();
      seated.add(m.a!);
      seated.add(m.b!);
    }
    expect(seated.size).toBe(4);
    // none auto-resolved
    expect(wb1.every((m) => m.status === 'pending')).toBe(true);
  });
});

describe('createBracket byes (N=3)', () => {
  const players = makePlayers(3); // P=4, 1 bye → top seed advances free
  const state = createBracket(players, 1, 'Three');

  it('top seed gets a bye that is auto-resolved and propagated', () => {
    // One WB round-1 match should be a bye (b == null), already reported.
    const wb1 = state.matches.filter((m) => m.bracket === 'W' && m.round === 1);
    const byes = wb1.filter((m) => m.b == null || m.a == null);
    expect(byes.length).toBe(1);
    expect(byes[0].status).toBe('reported');
    expect(byes[0].winner).toBe('p1'); // top seed
  });

  it('phase is running, no champion yet', () => {
    expect(state.phase).toBe('running');
    expect(state.championId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// reportResult validation
// ---------------------------------------------------------------------------

describe('reportResult validation', () => {
  const players = makePlayers(8);
  const state = createBracket(players, 1, 'Eight');
  const open = playable(state);

  it('throws on equal scores', () => {
    expect(() => reportResult(state, open[0].id, 2, 2)).toThrow();
  });

  it('throws on unknown matchId', () => {
    expect(() => reportResult(state, 'NOPE-9-9', 3, 1)).toThrow();
  });

  it('throws when reporting an already-reported match', () => {
    const next = reportResult(state, open[0].id, 3, 1);
    expect(() => reportResult(next, open[0].id, 3, 1)).toThrow();
  });

  it('throws when a/b not both set', () => {
    // Find a downstream WB final that has no players yet.
    const wbFinal = state.matches.find(
      (m) => m.bracket === 'W' && m.round === 3,
    )!;
    expect(wbFinal.a == null || wbFinal.b == null).toBe(true);
    expect(() => reportResult(state, wbFinal.id, 3, 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// reportResult propagation correctness
// ---------------------------------------------------------------------------

describe('reportResult propagation (N=4)', () => {
  it('winner advances to WB final, loser drops to LB', () => {
    const players = makePlayers(4);
    const state = createBracket(players, 1, 'Four');
    const wb1 = state.matches
      .filter((m) => m.bracket === 'W' && m.round === 1)
      .sort((a, b) => a.slot - b.slot);
    const m0 = wb1[0]; // a=p1 (seed1) vs b=p4 (seed8 slot but only 4 players)
    const winnerA = m0.a!;
    const loserB = m0.b!;
    const next = reportResult(state, m0.id, 3, 1);

    // WB final side a now holds winnerA.
    const wbFinal = next.matches.find((m) => m.id === m0.winTo!.matchId)!;
    const placed = m0.winTo!.side === 'a' ? wbFinal.a : wbFinal.b;
    expect(placed).toBe(winnerA);

    // Loser dropped into LB.
    expect(m0.loseTo).not.toBeNull();
    const lbDest = next.matches.find((m) => m.id === m0.loseTo!.matchId)!;
    const lbPlaced = m0.loseTo!.side === 'a' ? lbDest.a : lbDest.b;
    expect(lbPlaced).toBe(loserB);
  });
});

// ---------------------------------------------------------------------------
// resetResult
// ---------------------------------------------------------------------------

describe('resetResult', () => {
  it('throws on unknown / not-reported matches', () => {
    const players = makePlayers(4);
    const state = createBracket(players, 1, 'Four');
    expect(() => resetResult(state, 'NOPE')).toThrow();
    const open = playable(state);
    // open[0] is pending, not reported
    expect(() => resetResult(state, open[0].id)).toThrow();
  });

  it('clears a reported result and its downstream effects', () => {
    const players = makePlayers(4);
    let state = createBracket(players, 1, 'Four');
    const wb1 = state.matches
      .filter((m) => m.bracket === 'W' && m.round === 1)
      .sort((a, b) => a.slot - b.slot);
    const m0 = wb1[0];
    const winner = m0.a!;
    state = reportResult(state, m0.id, 3, 1);

    // winner is now placed downstream
    const dest = state.matches.find((m) => m.id === m0.winTo!.matchId)!;
    const placedSide = m0.winTo!.side;
    expect((placedSide === 'a' ? dest.a : dest.b)).toBe(winner);

    // reset it
    const reset = resetResult(state, m0.id);
    const m0After = reset.matches.find((m) => m.id === m0.id)!;
    expect(m0After.status).toBe('pending');
    expect(m0After.winner).toBeNull();

    // downstream slot cleared
    const destAfter = reset.matches.find((m) => m.id === m0.winTo!.matchId)!;
    expect(placedSide === 'a' ? destAfter.a : destAfter.b).toBeNull();
  });

  it('reset then re-report converges to a valid completion', () => {
    const players = makePlayers(8);
    const seedRank = seedRankOf(players);
    let state = createBracket(players, 1, 'Eight');
    const rand = mulberry32(42);

    // Play a few matches.
    for (let i = 0; i < 3; i++) {
      const open = playable(state);
      state = reportResult(state, open[0].id, 3, 1);
    }
    // Reset the first reported genuine match.
    const firstReported = state.matches.find(
      (m) => m.status === 'reported' && m.a != null && m.b != null,
    )!;
    state = resetResult(state, firstReported.id);

    // Now finish the tournament; should still complete with valid invariants.
    const { state: final } = simulate(state, randomDecider, rand, seedRank);
    assertInvariants(final, players);
  });

  it('does not mutate input state', () => {
    const players = makePlayers(4);
    let state = createBracket(players, 1, 'Four');
    const wb1 = state.matches.filter((m) => m.bracket === 'W' && m.round === 1);
    state = reportResult(state, wb1[0].id, 3, 1);
    deepFreeze(state);
    const before = JSON.stringify(state);
    const reset = resetResult(state, wb1[0].id);
    expect(JSON.stringify(state)).toBe(before);
    expect(reset).not.toBe(state);
  });
});

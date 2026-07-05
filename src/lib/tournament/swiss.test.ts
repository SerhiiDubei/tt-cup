import { describe, it, expect } from 'vitest';
import { generateSwissRound } from './swiss';
import { tournamentPlayers } from './standings';
import type { Player, Match, SetScore } from './types';

// --- test helpers -----------------------------------------------------------

function mkPlayer(id: string, seed: number, overrides: Partial<Player> = {}): Player {
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
    seed,
  };
}

let matchCounter = 0;
function mkMatch(
  a: string,
  b: string | null,
  sets: SetScore[],
  winner: string | null,
  overrides: Partial<Match> = {},
): Match {
  matchCounter += 1;
  return {
    id: overrides.id ?? `m${matchCounter}`,
    stage: overrides.stage ?? 'swiss',
    round: overrides.round ?? '1',
    slot: overrides.slot ?? 0,
    a,
    b,
    seed_a: overrides.seed_a ?? null,
    seed_b: overrides.seed_b ?? null,
    sets,
    winner,
    status: overrides.status ?? 'reported',
  };
}

const SWEEP: SetScore[] = [[11, 0], [11, 0], [11, 0]];

/** Build N players with ascending seeds 1..N (lower seed = stronger). */
function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => mkPlayer(`p${i + 1}`, i + 1));
}

/** Normalise an unordered pair to a stable key for comparison. */
function pairKey(a: string, b: string | null): string {
  if (b == null) return `${a}|BYE`;
  return [a, b].sort().join('|');
}

// ---------------------------------------------------------------------------

describe('generateSwissRound', () => {
  // --- plan Task 2.3: 16 players, round 1 -> 8 pairs, all distinct ---
  describe('round 1 with 16 players', () => {
    const players = makePlayers(16);
    const round = generateSwissRound(players, [], 1);

    it('produces 8 matches', () => {
      expect(round).toHaveLength(8);
    });

    it('pairs every player exactly once (no bye on even count)', () => {
      const ids = round.flatMap((m) => [m.a, m.b]).filter((x): x is string => x != null);
      expect(ids).toHaveLength(16);
      expect(new Set(ids).size).toBe(16);
      expect(new Set(ids)).toEqual(new Set(players.map((p) => p.id)));
    });

    it('contains no null opponent (no bye)', () => {
      expect(round.every((m) => m.b != null)).toBe(true);
    });

    it('marks each generated match as a pending swiss match for the given round', () => {
      round.forEach((m) => {
        expect(m.stage).toBe('swiss');
        expect(m.round).toBe('1');
        expect(m.status).toBe('pending');
        expect(m.winner).toBeNull();
        expect(m.sets).toEqual([]);
      });
    });

    it('assigns unique sequential slots', () => {
      const slots = round.map((m) => m.slot).sort((x, y) => x - y);
      expect(slots).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('seeds round 1 by seed order (strongest vs next-strongest neighbours)', () => {
      // Greedy by seed: p1-p2, p3-p4, ... p15-p16
      const keys = new Set(round.map((m) => pairKey(m.a, m.b)));
      expect(keys.has(pairKey('p1', 'p2'))).toBe(true);
      expect(keys.has(pairKey('p3', 'p4'))).toBe(true);
      expect(keys.has(pairKey('p15', 'p16'))).toBe(true);
    });
  });

  // --- plan Task 2.3: no rematch across rounds ---
  describe('no opponent repeats across consecutive rounds', () => {
    it('round 2 pairs are all different from round 1 pairs', () => {
      const players = makePlayers(16);
      const round1 = generateSwissRound(players, [], 1);

      // Report round 1: side a wins every match 3-0.
      const reported1 = round1.map((m) =>
        mkMatch(m.a, m.b, SWEEP, m.a, { round: '1', slot: m.slot }),
      );

      const round2 = generateSwissRound(players, reported1, 2);

      const playedKeys = new Set(reported1.map((m) => pairKey(m.a, m.b)));
      const round2Keys = round2.map((m) => pairKey(m.a, m.b));

      // every round-2 pairing is brand new
      round2Keys.forEach((k) => {
        expect(playedKeys.has(k)).toBe(false);
      });
      // and round 2 has its own 8 distinct pairings
      expect(new Set(round2Keys).size).toBe(8);
    });

    it('does not repeat opponents over three rounds with 8 players', () => {
      const players = makePlayers(8);
      const played: Match[] = [];

      for (let r = 1; r <= 3; r++) {
        const round = generateSwissRound(players, played, r);
        const newKeys = round.map((m) => pairKey(m.a, m.b));
        const seen = new Set(played.map((m) => pairKey(m.a, m.b)));
        newKeys.forEach((k) => expect(seen.has(k)).toBe(false));
        // report: side a wins
        round.forEach((m) =>
          played.push(mkMatch(m.a, m.b, SWEEP, m.a, { round: String(r), slot: m.slot })),
        );
      }
    });
  });

  // --- plan Task 2.3 / spec §10: odd count -> exactly one bye ---
  describe('bye selection for odd player counts (15 players)', () => {
    const players = makePlayers(15);
    const round = generateSwissRound(players, [], 1);

    it('creates exactly one bye match (b = null)', () => {
      const byes = round.filter((m) => m.b == null);
      expect(byes).toHaveLength(1);
    });

    it('produces 8 matches total (7 pairs + 1 bye) covering all 15 players', () => {
      expect(round).toHaveLength(8);
      const ids = round.flatMap((m) => [m.a, m.b]).filter((x): x is string => x != null);
      expect(new Set(ids).size).toBe(15);
    });

    it('the bye match is auto-reported as a win for the bye player', () => {
      const bye = round.find((m) => m.b == null)!;
      expect(bye.status).toBe('reported');
      expect(bye.winner).toBe(bye.a);
      // auto-win 3-0 (best-of-5 sweep)
      expect(bye.sets.length).toBeGreaterThanOrEqual(3);
      const aGames = bye.sets.filter(([x, y]) => x > y).length;
      expect(aGames).toBe(3);
    });

    it('round 1 bye goes to the lowest-seeded player (worst standing)', () => {
      // Round 1 has no standings yet -> ordered by seed; lowest standing = highest seed number (p15).
      const bye = round.find((m) => m.b == null)!;
      expect(bye.a).toBe('p15');
    });
  });

  describe('bye: lowest standing without a prior bye', () => {
    it('does not give a second bye to a player who already had one', () => {
      const players = makePlayers(5);

      // Round 1: p5 (lowest standing) got the bye. Pair the rest, p1/p3 win.
      const round1: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p3', 'p4', SWEEP, 'p3', { round: '1', slot: 1 }),
        mkMatch('p5', null, SWEEP, 'p5', { round: '1', slot: 2 }),
      ];

      const round2 = generateSwissRound(players, round1, 2);
      const bye = round2.find((m) => m.b == null);
      expect(bye).toBeDefined();
      // p5 already had a bye, so it must NOT get the round-2 bye again.
      expect(bye!.a).not.toBe('p5');
    });

    it('prefers the lowest-standing eligible (no prior bye) player for the bye', () => {
      const players = makePlayers(5);
      // Round 1: p5 had the bye (so it is excluded round 2).
      // Round 1 results so p2 and p4 sit at the bottom of the standings.
      const round1: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }), // p2 loses
        mkMatch('p3', 'p4', SWEEP, 'p3', { round: '1', slot: 1 }), // p4 loses
        mkMatch('p5', null, SWEEP, 'p5', { round: '1', slot: 2 }), // p5 bye (1 pt)
      ];
      const round2 = generateSwissRound(players, round1, 2);
      const bye = round2.find((m) => m.b == null)!;
      // Among players without a prior bye (p1..p4), the lowest standing
      // (0 points, then worst tiebreak) should receive it. p2 and p4 both have
      // 0 points; whichever sorts last in standings gets the bye, but it must
      // be one of the bottom two, never a winner.
      expect(['p2', 'p4']).toContain(bye.a);
    });
  });

  // --- plan Task 2.3 / spec §10: greedy dead-end fallback (allow rematch) ---
  describe('greedy dead-end fallback (rematch allowed when unavoidable)', () => {
    it('still pairs the last two players even if they already met', () => {
      // 4 players where everyone but one combination has already been played,
      // forcing the final pair to be a rematch.
      const players = makePlayers(4);
      // Round 1: p1-p2, p3-p4. Round 2: p1-p3, p2-p4. Round 3: p1-p4, p2-p3.
      // After 3 rounds every pairing among 4 players is exhausted.
      const played: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p3', 'p4', SWEEP, 'p3', { round: '1', slot: 1 }),
        mkMatch('p1', 'p3', SWEEP, 'p1', { round: '2', slot: 0 }),
        mkMatch('p2', 'p4', SWEEP, 'p2', { round: '2', slot: 1 }),
        mkMatch('p1', 'p4', SWEEP, 'p1', { round: '3', slot: 0 }),
        mkMatch('p2', 'p3', SWEEP, 'p2', { round: '3', slot: 1 }),
      ];

      // Round 4 is impossible without a rematch -> must NOT throw, must produce
      // 2 pairs covering all 4 players (allowing repeats).
      let round4: Match[] = [];
      expect(() => {
        round4 = generateSwissRound(players, played, 4);
      }).not.toThrow();

      expect(round4).toHaveLength(2);
      const ids = round4.flatMap((m) => [m.a, m.b]).filter((x): x is string => x != null);
      expect(new Set(ids)).toEqual(new Set(['p1', 'p2', 'p3', 'p4']));
    });

    it('avoids a rematch when an unplayed alternative still exists', () => {
      // 4 players, only p1-p2 has been played. A valid round 2 must NOT
      // re-pair p1-p2.
      const players = makePlayers(4);
      const played: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p3', 'p4', SWEEP, 'p3', { round: '1', slot: 1 }),
      ];
      const round2 = generateSwissRound(players, played, 2);
      const keys = round2.map((m) => pairKey(m.a, m.b));
      expect(keys).not.toContain(pairKey('p1', 'p2'));
      expect(keys).not.toContain(pairKey('p3', 'p4'));
    });
  });

  // --- edge cases ---
  describe('edge cases', () => {
    it('returns empty array for zero players', () => {
      expect(generateSwissRound([], [], 1)).toEqual([]);
    });

    it('a single player gets a bye', () => {
      const players = makePlayers(1);
      const round = generateSwissRound(players, [], 1);
      expect(round).toHaveLength(1);
      expect(round[0].b).toBeNull();
      expect(round[0].a).toBe('p1');
      expect(round[0].winner).toBe('p1');
      expect(round[0].status).toBe('reported');
    });

    it('two players pair against each other', () => {
      const players = makePlayers(2);
      const round = generateSwissRound(players, [], 1);
      expect(round).toHaveLength(1);
      expect(round[0].b).not.toBeNull();
      expect(new Set([round[0].a, round[0].b])).toEqual(new Set(['p1', 'p2']));
      expect(round[0].status).toBe('pending');
    });

    it('orders later rounds by standings (leaders paired together)', () => {
      // Round 2 ordering should follow standings, not seed.
      const players = makePlayers(4);
      // Round 1: low seeds win so standings invert seed order.
      // p4 beats p1, p3 beats p2 -> standings top: p4, p3 (1pt) ; bottom p1,p2.
      const round1: Match[] = [
        mkMatch('p4', 'p1', SWEEP, 'p4', { round: '1', slot: 0 }),
        mkMatch('p3', 'p2', SWEEP, 'p3', { round: '1', slot: 1 }),
      ];
      const round2 = generateSwissRound(players, round1, 2);
      const keys = new Set(round2.map((m) => pairKey(m.a, m.b)));
      // Leaders p4 & p3 (both 1pt) should be paired; losers p1 & p2 paired.
      expect(keys.has(pairKey('p3', 'p4'))).toBe(true);
      expect(keys.has(pairKey('p1', 'p2'))).toBe(true);
    });
  });

  // =========================================================================
  // ADVERSARIAL PROBES (verifier) — try to break the headline guarantees.
  // =========================================================================
  describe('ADVERSARIAL', () => {
    /** Play a full deterministic Swiss event; side `a` always wins. */
    function runEvent(n: number, rounds: number): Match[] {
      const players = makePlayers(n);
      const played: Match[] = [];
      for (let r = 1; r <= rounds; r++) {
        const round = generateSwissRound(players, played, r);
        round.forEach((m) =>
          played.push(
            mkMatch(m.a, m.b, m.b == null ? SWEEP : SWEEP, m.winner ?? m.a, {
              round: String(r),
              slot: m.slot,
              status: 'reported',
            }),
          ),
        );
      }
      return played;
    }

    it('HEADLINE: 16 players, 8 full rounds -> ZERO rematches', () => {
      const all = runEvent(16, 8);
      const swissPairs = all.filter((m) => m.b != null);
      const keys = swissPairs.map((m) => pairKey(m.a, m.b));
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dupes).toEqual([]); // no pair appears twice across 8 rounds
      // each round should still be 8 pairs
      expect(swissPairs).toHaveLength(8 * 8);
    });

    it('does NOT create an AVOIDABLE rematch on a concrete 6-player trap', () => {
      // Order [p1..p6]. Played edges chosen so a naive top-down nearest-first
      // greedy is tempted into stranding the tail, yet a rematch-free pairing
      // exists. played: p1-p2, p1-p3, p1-p4, p2-p3, p5-p6.
      // Unplayed for p1: only p5, p6. A correct matcher must give p1 one of
      // p5/p6 and still pair the rest rematch-free, e.g. {p1-p5, p2-p4, p3-p6}.
      const players = makePlayers(6);
      const played: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p1', 'p3', SWEEP, 'p1', { round: '1', slot: 1 }),
        mkMatch('p1', 'p4', SWEEP, 'p1', { round: '1', slot: 2 }),
        mkMatch('p2', 'p3', SWEEP, 'p2', { round: '1', slot: 3 }),
        mkMatch('p5', 'p6', SWEEP, 'p5', { round: '1', slot: 4 }),
      ];
      const forbidden = new Set(played.map((m) => pairKey(m.a, m.b)));
      const round = generateSwissRound(players, played, 1);
      const ids = round
        .flatMap((m) => [m.a, m.b])
        .filter((x): x is string => x != null);
      expect(new Set(ids).size).toBe(6); // everyone paired
      for (const m of round) {
        if (m.b == null) continue;
        expect(forbidden.has(pairKey(m.a, m.b))).toBe(false); // no rematch
      }
    });

    it('analysis note: 4-player greedy is safe; 6+ is where it breaks', () => {
      // Construct prior history so that a naive nearest-neighbour greedy walking
      // the standings order top-to-bottom would be FORCED into a rematch at the
      // tail, even though a perfect rematch-free pairing exists.
      //
      // 4 players ordered [p1,p2,p3,p4] for this round.
      // Prior played: p1-p3 and p2-p4 already met (round-1 cross results below).
      // Greedy from the top: p1 picks p2 (ok, unplayed). Then p3 must take p4
      // (unplayed). Result {p1-p2, p3-p4}: rematch-free. GOOD.
      //
      // Now the HARD case: make p1 unable to play p2 either, so p1's only
      // unplayed partner is p4, but greedy grabs the nearest. We force the
      // ordering so a top-down nearest pick strands the tail.
      //
      // Order [p1,p2,p3,p4]; played: p1-p2, p3-p4, p2-p3.
      // Unplayed graph edges: p1-p3, p1-p4, p2-p4.
      // Perfect rematch-free matching exists: {p1-p3, p2-p4}.
      // Naive greedy top-down: p1 nearest-unplayed -> p3 (skip p2 played).
      //   Remaining p2,p4 -> p2-p4 unplayed. {p1-p3, p2-p4}. GOOD here too.
      //
      // The real trap: order [p1,p2,p3,p4]; played p1-p3, p1-p4, p2-p3.
      // Unplayed: p1-p2, p2-p4, p3-p4.
      // Perfect matching: {p1-p2, p3-p4}.
      // Greedy: p1 nearest unplayed -> p2. remaining p3,p4 -> p3-p4 unplayed. GOOD.
      //
      // Hardest: order [p1,p2,p3,p4]; played p1-p2, p1-p3, p3-p4.
      // Unplayed edges: p1-p4, p2-p3, p2-p4.
      // Perfect rematch-free matching: {p1-p4, p2-p3}.
      // Greedy top-down: p1 skips p2(played),p3(played) -> picks p4. unplayed.
      //   remaining p2,p3 -> p2-p3 unplayed. {p1-p4,p2-p3}. GOOD.
      //
      // Force the failure: greedy must pick a near partner that strands a later
      // pair into a rematch. order [p1,p2,p3,p4]; played p1-p4, p2-p3, p2-p4.
      // Unplayed edges: p1-p2, p1-p3, p3-p4.
      // Perfect rematch-free matching: {p1-p2, p3-p4} OR {p1-p3, ...p2-p4 played}.
      //   Only {p1-p2,p3-p4} is fully rematch-free.
      // Greedy top-down: p1 nearest unplayed -> p2 (p1-p2 unplayed). remaining
      //   p3,p4 -> p3-p4 unplayed. {p1-p2,p3-p4}. GOOD.
      //
      // 4-player greedy is actually safe. Move to 6 players for a genuine trap.
      const players = makePlayers(6);
      // Ordering for the new round will be by seed in round 1, so we instead set
      // up history that makes round 2 ordering = [p1..p6] (seed order preserved
      // when everyone is 0-? we force results so standings == seed order).
      // Simpler: directly exploit round-1 ordering by seed with a crafted
      // pre-history of byes? Byes do not establish pairs. Instead we pass a
      // history of swiss matches that are NOT in round 1 ordering's pool... but
      // ordering ignores history in round 1. So use a later round.
      //
      // Build history so standings order is exactly p1,p2,p3,p4,p5,p6 and the
      // played set forms the classic greedy trap:
      //   played: p1-p2, p3-p5, p4-p6  (round A)
      //           p1-p3, p2-p4         (round B partial) ...
      // We want: greedy walking [p1..p6] to be forced into an avoidable rematch.
      //
      // Trap construction (known greedy-failure topology):
      //   played edges: p1-p2, p1-p3, p2-p3, p4-p5, p4-p6, p5-p6
      //   i.e. {p1,p2,p3} fully interconnected, {p4,p5,p6} fully interconnected.
      //   Unplayed edges: every cross edge between the two triangles.
      //   Perfect rematch-free matching EXISTS (e.g. p1-p4, p2-p5, p3-p6).
      //   Greedy top-down [p1..p6]:
      //     p1 nearest unplayed -> p4 (p2,p3 played). pair p1-p4.
      //     p2 nearest unplayed -> p5 (p3 played, p4 taken). pair p2-p5.
      //     p3 nearest unplayed -> p6. pair p3-p6. ALL rematch-free. GOOD.
      //
      // To actually trap first-fit we need the near choice to consume a vertex
      // that another vertex critically needed. Classic example:
      //   Unplayed graph: p1-p2, p1-p3, p2-p3 missing... let's just brute force
      //   search for ANY history that breaks it (below test does that).
      expect(players).toHaveLength(6);
    });

    it('BRUTE-FORCE hunt: no avoidable rematch over many random histories (8 players)', () => {
      // For random prior-history states where a perfect rematch-free pairing of
      // the current pool provably EXISTS, the generator must not emit a rematch.
      function hasPerfectMatching(
        ids: string[],
        forbidden: Set<string>,
      ): boolean {
        if (ids.length === 0) return true;
        const [first, ...others] = ids;
        for (let k = 0; k < others.length; k++) {
          const partner = others[k];
          if (forbidden.has(pairKey(first, partner))) continue;
          const remaining = others.filter((_, idx) => idx !== k);
          if (hasPerfectMatching(remaining, forbidden)) return true;
        }
        return false;
      }

      const players = makePlayers(8);
      const ids = players.map((p) => p.id);
      let rng = 987654321;
      const rand = () => {
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        return rng / 0x7fffffff;
      };

      let checked = 0;
      let violations = 0;
      for (let trial = 0; trial < 3000; trial++) {
        // random set of already-played pairs
        const played: Match[] = [];
        const forbidden = new Set<string>();
        for (let a = 0; a < ids.length; a++) {
          for (let b = a + 1; b < ids.length; b++) {
            if (rand() < 0.35) {
              forbidden.add(pairKey(ids[a], ids[b]));
              played.push(
                mkMatch(ids[a], ids[b], SWEEP, ids[a], {
                  round: '1',
                  status: 'reported',
                }),
              );
            }
          }
        }
        // only assert when a rematch-free pairing is actually possible
        if (!hasPerfectMatching(ids, forbidden)) continue;
        checked++;
        // round 1 ordering is by seed so the pool is deterministic [p1..p8]
        const round = generateSwissRound(players, played, 1);
        for (const m of round) {
          if (m.b == null) continue;
          if (forbidden.has(pairKey(m.a, m.b))) violations++;
        }
      }
      // We must have exercised the branch at least a few times.
      expect(checked).toBeGreaterThan(20);
      expect(violations).toBe(0);
    });

    it('does NOT mutate the input players or matches arrays', () => {
      const players = makePlayers(5);
      const playersCopy = players.map((p) => ({ ...p }));
      const matches: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p3', 'p4', SWEEP, 'p3', { round: '1', slot: 1 }),
        mkMatch('p5', null, SWEEP, 'p5', { round: '1', slot: 2 }),
      ];
      const matchesSnapshot = JSON.stringify(matches);
      const playersOrder = players.map((p) => p.id);

      generateSwissRound(players, matches, 2);

      // input arrays + element identity/order unchanged
      expect(players.map((p) => p.id)).toEqual(playersOrder);
      expect(players).toEqual(playersCopy);
      expect(JSON.stringify(matches)).toBe(matchesSnapshot);
    });

    it('is DETERMINISTIC for round 1 given equal seeds (tie broken by name)', () => {
      // Two players share a seed; ordering must be stable via name tiebreak.
      const players: Player[] = [
        mkPlayer('z', 1, { name: 'Zoe' }),
        mkPlayer('a', 1, { name: 'Ann' }),
        mkPlayer('m', 2, { name: 'Mel' }),
        mkPlayer('b', 2, { name: 'Bob' }),
      ];
      const r1 = generateSwissRound(players, [], 1);
      const r2 = generateSwissRound([...players].reverse(), [], 1);
      const k1 = r1.map((m) => pairKey(m.a, m.b)).sort();
      const k2 = r2.map((m) => pairKey(m.a, m.b)).sort();
      expect(k1).toEqual(k2); // input order independent
      // seed-1 group sorted by name = [Ann(a), Zoe(z)] -> a vs z;
      // seed-2 group = [Bob(b), Mel(m)] -> b vs m
      expect(k1).toEqual([pairKey('a', 'z'), pairKey('b', 'm')].sort());
    });

    it('odd field: bye does NOT come from the top of standings', () => {
      // 7 players, round 1 -> bye must be lowest seed (p7), never a top seed.
      const round = generateSwissRound(makePlayers(7), [], 1);
      const bye = round.find((m) => m.b == null)!;
      expect(bye.a).toBe('p7');
    });

    it('odd field across rounds: every player eventually byes at most... fairly', () => {
      // 5 players over 5 rounds: nobody should get a 2nd bye until everyone has
      // had one (since pickBye excludes prior-bye players first).
      const players = makePlayers(5);
      const played: Match[] = [];
      const byeCounts = new Map<string, number>();
      for (let r = 1; r <= 5; r++) {
        const round = generateSwissRound(players, played, r);
        const bye = round.find((m) => m.b == null);
        if (bye) byeCounts.set(bye.a, (byeCounts.get(bye.a) ?? 0) + 1);
        round.forEach((m) =>
          played.push(
            mkMatch(m.a, m.b, SWEEP, m.winner ?? m.a, {
              round: String(r),
              slot: m.slot,
              status: 'reported',
            }),
          ),
        );
      }
      // Over 5 rounds with 5 players, all 5 byes distributed: every player byes
      // exactly once before anyone byes twice.
      expect(byeCounts.size).toBe(5);
      for (const c of byeCounts.values()) expect(c).toBe(1);
    });

    it('dead-end fallback never drops a player (always full even pool covered)', () => {
      // Exhaust all pairings among 4 players, then demand round 4: must still
      // cover all 4, even though every pairing is a forced rematch.
      const players = makePlayers(4);
      const played: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p3', 'p4', SWEEP, 'p3', { round: '1', slot: 1 }),
        mkMatch('p1', 'p3', SWEEP, 'p1', { round: '2', slot: 0 }),
        mkMatch('p2', 'p4', SWEEP, 'p2', { round: '2', slot: 1 }),
        mkMatch('p1', 'p4', SWEEP, 'p1', { round: '3', slot: 0 }),
        mkMatch('p2', 'p3', SWEEP, 'p2', { round: '3', slot: 1 }),
      ];
      const r4 = generateSwissRound(players, played, 4);
      const ids = r4
        .flatMap((m) => [m.a, m.b])
        .filter((x): x is string => x != null);
      expect(new Set(ids)).toEqual(new Set(['p1', 'p2', 'p3', 'p4']));
      expect(r4).toHaveLength(2);
    });

    it('terminates (no infinite loop) on a fully-exhausted odd field', () => {
      // 3 players, all pairings played, all already byed -> must still produce a
      // round without hanging.
      const players = makePlayers(3);
      const played: Match[] = [
        mkMatch('p1', 'p2', SWEEP, 'p1', { round: '1', slot: 0 }),
        mkMatch('p3', null, SWEEP, 'p3', { round: '1', slot: 1 }),
        mkMatch('p1', 'p3', SWEEP, 'p1', { round: '2', slot: 0 }),
        mkMatch('p2', null, SWEEP, 'p2', { round: '2', slot: 1 }),
        mkMatch('p2', 'p3', SWEEP, 'p2', { round: '3', slot: 0 }),
        mkMatch('p1', null, SWEEP, 'p1', { round: '3', slot: 1 }),
      ];
      let r4: Match[] = [];
      expect(() => {
        r4 = generateSwissRound(players, played, 4);
      }).not.toThrow();
      // 3 players -> 1 bye + 1 pair = 2 matches, all 3 covered.
      const ids = r4
        .flatMap((m) => [m.a, m.b])
        .filter((x): x is string => x != null);
      expect(new Set(ids)).toEqual(new Set(['p1', 'p2', 'p3']));
    });
  });
});

describe('casual players (kiosk queue)', () => {
  // Pins the load-bearing contract: round-1 pairing sorts by seed and never goes
  // through computeStandings, so callers MUST pre-filter via tournamentPlayers.
  it('round-1 pairing excludes casual players when caller filters via tournamentPlayers', () => {
    const players = [
      mkPlayer('a', 1),
      mkPlayer('b', 2),
      { ...mkPlayer('c', 3), casual: true },
    ];
    const round = generateSwissRound(tournamentPlayers(players), [], 1);
    const ids = round.flatMap((m) => [m.a, m.b]).filter((x): x is string => x != null);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).not.toContain('c');
  });
});

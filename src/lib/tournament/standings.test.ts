import { describe, it, expect } from 'vitest';
import { computeStandings } from './standings';
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

// Standard 3-0 sweep set scores so winner has gw=3, gl=0.
const SWEEP: SetScore[] = [[11, 0], [11, 0], [11, 0]];
// 3-1 set scores: winner gw=3 gl=1.
const THREE_ONE: SetScore[] = [[11, 7], [9, 11], [11, 5], [11, 8]];

// ---------------------------------------------------------------------------

describe('computeStandings', () => {
  // --- plan Task 2.2: 4 players, several reported swiss matches ---
  describe('plan core case (4 players)', () => {
    // Players A, B, C, D. Round results:
    //   A beats B 3-0, C beats D 3-1   (round 1)
    //   A beats C 3-0, B beats D 3-0   (round 2)
    // Standings by points:
    //   A: 2 wins, B: 1, C: 1, D: 0
    const players = [
      mkPlayer('A'),
      mkPlayer('B'),
      mkPlayer('C'),
      mkPlayer('D'),
    ];
    const matches = [
      mkMatch('A', 'B', SWEEP, 'A', { round: '1' }),
      mkMatch('C', 'D', THREE_ONE, 'C', { round: '1' }),
      mkMatch('A', 'C', SWEEP, 'A', { round: '2' }),
      mkMatch('B', 'D', SWEEP, 'B', { round: '2' }),
    ];

    it('returns one row per player', () => {
      const table = computeStandings(players, matches);
      expect(table).toHaveLength(4);
      expect(new Set(table.map((r) => r.id))).toEqual(
        new Set(['A', 'B', 'C', 'D']),
      );
    });

    it('sorts by points first (A on top, D at bottom)', () => {
      const table = computeStandings(players, matches);
      expect(table[0].id).toBe('A');
      expect(table[table.length - 1].id).toBe('D');
    });

    it('awards 1 point per win', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.points).toBe(2);
      expect(byId.B.points).toBe(1);
      expect(byId.C.points).toBe(1);
      expect(byId.D.points).toBe(0);
    });

    it('counts wins and losses', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.wins).toBe(2);
      expect(byId.A.losses).toBe(0);
      expect(byId.B.wins).toBe(1);
      expect(byId.B.losses).toBe(1);
      expect(byId.C.wins).toBe(1);
      expect(byId.C.losses).toBe(1);
      expect(byId.D.wins).toBe(0);
      expect(byId.D.losses).toBe(2);
    });

    it('counts games won (gw) and games lost (gl)', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      // A: 3-0 then 3-0  => gw 6, gl 0
      expect(byId.A.gw).toBe(6);
      expect(byId.A.gl).toBe(0);
      // C: won 3-1 (gw3 gl1), lost 0-3 (gw0 gl3) => gw3 gl4
      expect(byId.C.gw).toBe(3);
      expect(byId.C.gl).toBe(4);
      // D: lost 1-3 (gw1 gl3), lost 0-3 (gw0 gl3) => gw1 gl6
      expect(byId.D.gw).toBe(1);
      expect(byId.D.gl).toBe(6);
    });

    it('computes game difference gd = gw - gl', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.gd).toBe(6);
      expect(byId.C.gd).toBe(-1);
      expect(byId.D.gd).toBe(-5);
    });

    it('lists opponents faced', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(new Set(byId.A.opponents)).toEqual(new Set(['B', 'C']));
      expect(new Set(byId.D.opponents)).toEqual(new Set(['C', 'B']));
    });

    it('embeds the full player object on each row', () => {
      const table = computeStandings(players, matches);
      const a = table.find((r) => r.id === 'A')!;
      expect(a.player).toEqual(players[0]);
    });
  });

  // --- spec §10 tiebreak: points -> Buchholz -> set difference -> name ---
  describe('tiebreak: Buchholz (sum of opponents points)', () => {
    // Construct two players tied on points but with different-strength
    // opponents so Buchholz decides.
    //   A beats Strong(S), Strong also wins another match  => S has 1 pt
    //   B beats Weak(W),   Weak loses its other match       => W has 0 pt
    // A and B each have 1 point; A's opponent (S) has more points => A ranks higher.
    const players = [
      mkPlayer('A'),
      mkPlayer('B'),
      mkPlayer('S'),
      mkPlayer('W'),
      mkPlayer('X'),
    ];
    const matches = [
      mkMatch('A', 'S', SWEEP, 'A', { round: '1' }), // A beats S
      mkMatch('B', 'W', SWEEP, 'B', { round: '1' }), // B beats W
      mkMatch('S', 'X', SWEEP, 'S', { round: '2' }), // S beats X (S now 1 pt)
      mkMatch('W', 'X', SWEEP, 'X', { round: '3' }), // W loses to X (W 0 pt)
    ];

    it('ranks the player with stronger opponents (higher Buchholz) first', () => {
      const table = computeStandings(players, matches);
      const aPos = table.findIndex((r) => r.id === 'A');
      const bPos = table.findIndex((r) => r.id === 'B');
      const byId = Object.fromEntries(table.map((r) => [r.id, r]));
      // sanity: tied on points
      expect(byId.A.points).toBe(byId.B.points);
      // A's Buchholz (S has 1) > B's Buchholz (W has 0)
      expect(byId.A.buchholz).toBeGreaterThan(byId.B.buchholz);
      expect(aPos).toBeLessThan(bPos);
    });

    it('buchholz = sum of points of opponents faced', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      // A faced only S; S has 1 point.
      expect(byId.A.buchholz).toBe(1);
      // B faced only W; W has 0 points.
      expect(byId.B.buchholz).toBe(0);
    });
  });

  describe('tiebreak: set difference when points and Buchholz tie', () => {
    // P and Q both win once vs equally-weighted opponents, but P wins 3-0
    // and Q wins 3-1, giving P a better set difference.
    const players = [
      mkPlayer('P'),
      mkPlayer('Q'),
      mkPlayer('R'),
      mkPlayer('T'),
    ];
    const matches = [
      mkMatch('P', 'R', SWEEP, 'P', { round: '1' }), // P +3 -0
      mkMatch('Q', 'T', THREE_ONE, 'Q', { round: '1' }), // Q +3 -1
    ];

    it('ranks the player with better set difference first', () => {
      const table = computeStandings(players, matches);
      const byId = Object.fromEntries(table.map((r) => [r.id, r]));
      expect(byId.P.points).toBe(byId.Q.points);
      expect(byId.P.buchholz).toBe(byId.Q.buchholz); // both opponents have 0 pts
      expect(byId.P.gd).toBeGreaterThan(byId.Q.gd);
      expect(table.findIndex((r) => r.id === 'P')).toBeLessThan(
        table.findIndex((r) => r.id === 'Q'),
      );
    });
  });

  describe('tiebreak: name when everything else ties (stable, deterministic)', () => {
    const players = [
      mkPlayer('zeta', { name: 'Zeta', nickname: 'zeta' }),
      mkPlayer('alpha', { name: 'Alpha', nickname: 'alpha' }),
    ];
    // No matches: both 0 points, 0 Buchholz, 0 set diff -> sort by name.
    it('breaks a full tie alphabetically by name', () => {
      const table = computeStandings(players, []);
      expect(table.map((r) => r.id)).toEqual(['alpha', 'zeta']);
    });
  });

  // --- spec §10 edge case: bye (auto-win, opponent b = null) ---
  describe('bye matches (b = null, auto-win)', () => {
    const players = [mkPlayer('A'), mkPlayer('B')];
    // A gets a bye: a='A', b=null, winner='A', 3-0.
    const matches = [
      mkMatch('A', null, SWEEP, 'A', { round: '1' }),
    ];

    it('awards a win + point for a bye', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.points).toBe(1);
      expect(byId.A.wins).toBe(1);
      expect(byId.A.losses).toBe(0);
    });

    it('does not add a null opponent to the opponents list', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.opponents).not.toContain(null);
      expect(byId.A.opponents).toHaveLength(0);
    });

    it('a bye contributes nothing to anyone else Buchholz', () => {
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      // B never played; Buchholz 0.
      expect(byId.B.buchholz).toBe(0);
    });
  });

  // --- edge cases ---
  describe('edge cases', () => {
    it('ignores pending (unreported) matches', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      const matches = [
        mkMatch('A', 'B', [], null, { status: 'pending' }),
      ];
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.points).toBe(0);
      expect(byId.A.wins).toBe(0);
      expect(byId.A.opponents).toHaveLength(0);
    });

    it('ignores playoff matches (only swiss counts toward standings)', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      const matches = [
        mkMatch('A', 'B', SWEEP, 'A', { stage: 'playoff', round: 'QF' }),
      ];
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.points).toBe(0);
      expect(byId.B.points).toBe(0);
    });

    it('returns empty array for no players', () => {
      expect(computeStandings([], [])).toEqual([]);
    });

    it('handles players with zero matches', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      const table = computeStandings(players, []);
      expect(table).toHaveLength(2);
      table.forEach((r) => {
        expect(r.points).toBe(0);
        expect(r.wins).toBe(0);
        expect(r.losses).toBe(0);
        expect(r.gw).toBe(0);
        expect(r.gl).toBe(0);
        expect(r.gd).toBe(0);
        expect(r.buchholz).toBe(0);
        expect(r.opponents).toHaveLength(0);
      });
    });

    it('ignores matches referencing unknown player ids gracefully', () => {
      const players = [mkPlayer('A')];
      // 'ghost' is not in players list; standings should still include A only.
      const matches = [
        mkMatch('A', 'ghost', SWEEP, 'A', { round: '1' }),
      ];
      const table = computeStandings(players, matches);
      expect(table.map((r) => r.id)).toEqual(['A']);
      expect(table[0].wins).toBe(1);
      expect(table[0].points).toBe(1);
    });
  });

  // =========================================================================
  // ADVERSARIAL probes — hunting real bugs (spec §10)
  // =========================================================================
  describe('ADVERSARIAL probes', () => {
    // --- Buchholz must count a bye-winner's bye point for OTHERS ----------
    it('Buchholz of an opponent counts the bye point that opponent earned', () => {
      // A gets a bye (auto-win, +1 pt) AND beats B head-to-head.
      // B faced A. B's Buchholz must be A's TOTAL points (2: bye + win vs B),
      // not 1. The bye must not be stripped from A's *points*, only from
      // A's *opponents* list.
      const players = [mkPlayer('A'), mkPlayer('B')];
      const matches = [
        mkMatch('A', null, SWEEP, 'A', { round: '1' }), // bye -> A +1
        mkMatch('A', 'B', SWEEP, 'A', { round: '2' }), // A beats B -> A +1
      ];
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.points).toBe(2);
      // B faced A once; A has 2 points => B.buchholz must be 2.
      expect(byId.B.opponents).toEqual(['A']);
      expect(byId.B.buchholz).toBe(2);
      // A faced only B (bye excluded); B has 0 points.
      expect(byId.A.opponents).toEqual(['B']);
      expect(byId.A.buchholz).toBe(0);
    });

    // --- Buchholz counts a repeated opponent twice (greedy fallback) ------
    it('counts a repeated opponent twice in Buchholz', () => {
      // Greedy dead-end fallback can pair A vs B twice. If A faced B in two
      // rounds, B's points should be summed once per meeting.
      const players = [mkPlayer('A'), mkPlayer('B'), mkPlayer('C')];
      const matches = [
        mkMatch('B', 'C', SWEEP, 'B', { round: '1' }), // B +1
        mkMatch('A', 'B', SWEEP, 'A', { round: '2' }), // A faces B (#1)
        mkMatch('A', 'B', SWEEP, 'A', { round: '3' }), // A faces B (#2)
      ];
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      // B has 1 point (beat C). A faced B twice => Buchholz = 1 + 1 = 2.
      expect(byId.B.points).toBe(1);
      expect(byId.A.opponents).toEqual(['B', 'B']);
      expect(byId.A.buchholz).toBe(2);
    });

    // --- INPUT IMMUTABILITY: matches array + match objects ----------------
    it('does not mutate the input matches array or match objects', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      const m1 = mkMatch('A', 'B', SWEEP, 'A', { round: '1' });
      const matches = [m1];
      const matchesSnapshot = JSON.parse(JSON.stringify(matches));
      const matchesLen = matches.length;
      computeStandings(players, matches);
      expect(matches).toHaveLength(matchesLen);
      expect(JSON.parse(JSON.stringify(matches))).toEqual(matchesSnapshot);
    });

    // --- INPUT IMMUTABILITY: players array + player objects ---------------
    it('does not mutate the input players array or player objects', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      const playersSnapshot = JSON.parse(JSON.stringify(players));
      const playerRefs = [...players];
      computeStandings(players, [mkMatch('A', 'B', SWEEP, 'A')]);
      expect(players).toEqual(playerRefs); // array order untouched
      expect(JSON.parse(JSON.stringify(players))).toEqual(playersSnapshot);
    });

    // --- Standing.opponents must be a fresh array, not shared ------------
    it('returns distinct opponents arrays per row (no aliasing)', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      const table = computeStandings(players, [mkMatch('A', 'B', SWEEP, 'A')]);
      const a = table.find((r) => r.id === 'A')!;
      const b = table.find((r) => r.id === 'B')!;
      expect(a.opponents).not.toBe(b.opponents);
      a.opponents.push('TAINT');
      expect(b.opponents).not.toContain('TAINT');
    });

    // --- Full tiebreak chain exercised in ONE table ----------------------
    it('applies the full tiebreak chain points->buchholz->gd->name', () => {
      // hi-gd / lo-gd: 1 pt each, Buchholz 0 each (opponents lost everything),
      //   decided by gd (3-0 beats 3-1).
      // loser1 / loser2: 0 pts but Buchholz 1 each (each faced a 1-pt winner),
      //   so they outrank the never-played pair (Buchholz 0). Between them gd
      //   breaks the tie (loser1 lost 0-3 = gd -3; loser2 lost 1-3 = gd -2).
      // aaa / zzz: never played (0/0/0), decided by name (Aaa before Zzz).
      const players = [
        mkPlayer('hi-gd', { name: 'M-good' }),
        mkPlayer('lo-gd', { name: 'M-bad' }),
        mkPlayer('zzz', { name: 'Zzz' }),
        mkPlayer('aaa', { name: 'Aaa' }),
        mkPlayer('loser1', { name: 'L1' }),
        mkPlayer('loser2', { name: 'L2' }),
      ];
      const matches = [
        mkMatch('hi-gd', 'loser1', SWEEP, 'hi-gd'), // hi-gd +3 -0; loser1 gd -3
        mkMatch('lo-gd', 'loser2', THREE_ONE, 'lo-gd'), // lo-gd +3 -1; loser2 gd -2
      ];
      const table = computeStandings(players, matches);
      const order = table.map((r) => r.id);
      const byId = Object.fromEntries(table.map((r) => [r.id, r]));
      // points tier
      expect(byId['hi-gd'].points).toBe(1);
      expect(byId['lo-gd'].points).toBe(1);
      expect(byId.loser1.points).toBe(0);
      // winners first (1 pt), hi-gd before lo-gd (gd tiebreak, Buchholz tied)
      expect(byId['hi-gd'].buchholz).toBe(0);
      expect(byId['lo-gd'].buchholz).toBe(0);
      expect(order[0]).toBe('hi-gd');
      expect(order[1]).toBe('lo-gd');
      // losers carry Buchholz 1 (faced a 1-pt winner) => above never-played
      expect(byId.loser1.buchholz).toBe(1);
      expect(byId.loser2.buchholz).toBe(1);
      // loser2 (gd -2) ranks above loser1 (gd -3)
      expect(order.indexOf('loser2')).toBeLessThan(order.indexOf('loser1'));
      const aaaPos = order.indexOf('aaa');
      const zzzPos = order.indexOf('zzz');
      // never-played pair (Buchholz 0) sits at the very bottom, name-sorted
      expect(aaaPos).toBeLessThan(zzzPos);
      expect(order.indexOf('loser1')).toBeLessThan(aaaPos);
      expect(order.indexOf('loser2')).toBeLessThan(aaaPos);
      expect(order.slice(-2)).toEqual(['aaa', 'zzz']);
    });

    // --- DETERMINISM: identical names must still sort deterministically --
    it('is deterministic when two players share the exact same name', () => {
      // localeCompare returns 0 for equal names. If there is no further
      // tiebreak, JS sort order may be engine-dependent. The function must
      // return a STABLE, deterministic order regardless of input order.
      const p1 = mkPlayer('id-001', { name: 'Same' });
      const p2 = mkPlayer('id-002', { name: 'Same' });
      const forward = computeStandings([p1, p2], []).map((r) => r.id);
      const reversed = computeStandings([p2, p1], []).map((r) => r.id);
      expect(forward).toEqual(reversed);
    });

    // --- no-matches state: every numeric field is 0, full roster present -
    it('no-matches state yields all-zero rows for the whole roster', () => {
      const players = [mkPlayer('A'), mkPlayer('B'), mkPlayer('C')];
      const table = computeStandings(players, []);
      expect(table).toHaveLength(3);
      for (const r of table) {
        expect(r.points + r.wins + r.losses + r.gw + r.gl + r.gd + r.buchholz)
          .toBe(0);
        expect(r.opponents).toEqual([]);
      }
    });

    // --- a match whose winner is neither a nor b (corrupt data) ----------
    it('does not credit a win when winner matches neither side', () => {
      const players = [mkPlayer('A'), mkPlayer('B')];
      // winner = 'C' (a third party) — neither A nor B should get a WIN.
      const matches = [mkMatch('A', 'B', SWEEP, 'C')];
      const byId = Object.fromEntries(
        computeStandings(players, matches).map((r) => [r.id, r]),
      );
      expect(byId.A.wins).toBe(0);
      expect(byId.B.wins).toBe(0);
      expect(byId.A.points).toBe(0);
      expect(byId.B.points).toBe(0);
    });

    // --- bye where the bye player is unknown: must not throw -------------
    it('tolerates a bye for an unknown player without throwing', () => {
      const players = [mkPlayer('A')];
      const matches = [mkMatch('ghost', null, SWEEP, 'ghost', { round: '1' })];
      expect(() => computeStandings(players, matches)).not.toThrow();
      const table = computeStandings(players, matches);
      expect(table.map((r) => r.id)).toEqual(['A']);
      expect(table[0].points).toBe(0);
    });

    // --- terminates on a large roster (no accidental infinite loop) ------
    it('handles a large roster without hanging', () => {
      const players = Array.from({ length: 200 }, (_, i) =>
        mkPlayer(`p${String(i).padStart(3, '0')}`),
      );
      const matches: Match[] = [];
      for (let i = 0; i < players.length - 1; i += 2) {
        matches.push(mkMatch(players[i].id, players[i + 1].id, SWEEP, players[i].id));
      }
      const table = computeStandings(players, matches);
      expect(table).toHaveLength(200);
      // winners (100) on top with 1 pt
      expect(table.slice(0, 100).every((r) => r.points === 1)).toBe(true);
      expect(table.slice(100).every((r) => r.points === 0)).toBe(true);
    });

    it('excludes casual players from standings', () => {
      const players = [
        mkPlayer('a'),
        mkPlayer('b'),
        { ...mkPlayer('c'), casual: true },
      ];
      const rows = computeStandings(players, []);
      expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b']);
    });
  });
});

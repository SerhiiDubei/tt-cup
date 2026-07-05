import type { CupPlayer, CupMatch, CupState, Side } from './types';

/**
 * Double-elimination engine — precomputed bracket graph, single grand final
 * (NO bracket reset).
 *
 * The whole tournament is laid out as a static graph of {@link CupMatch} nodes
 * at creation time. Every match carries `winTo` / `loseTo` routing edges that
 * say exactly where its winner and loser flow. Reporting a result therefore
 * never has to "figure out" the next round — it just pushes players along the
 * precomputed edges. Byes (when N is not a power of two) are modeled as real
 * matches whose `b` side is `null`; they auto-resolve at creation and the
 * advancement propagates through the graph so the opening pending matches are
 * already correct.
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Deep clone of a CupState so all pure functions can return fresh state. */
function cloneState(state: CupState): CupState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, traits: { ...p.traits } })),
    matches: state.matches.map((m) => ({
      ...m,
      winTo: m.winTo ? { ...m.winTo } : null,
      loseTo: m.loseTo ? { ...m.loseTo } : null,
    })),
  };
}

/** Next power of two >= n. */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** log2 for exact powers of two. */
function log2(n: number): number {
  return Math.round(Math.log2(n));
}

const mkId = (bracket: string, round: number, slot: number): string =>
  `${bracket}-${round}-${slot}`;

/**
 * Standard single-elimination seeding order for a bracket of size P.
 *
 * Returns an array of length P giving the 1-based seed that occupies each
 * bracket position, top to bottom. Position pairs (0,1), (2,3) ... are the
 * round-1 matchups. For P=8 this yields [1,8,4,5,2,7,3,6] so #1 plays #8,
 * #4 plays #5, etc., and the top seeds get the byes when seeds beyond N are
 * "phantom".
 */
function seedOrder(P: number): number[] {
  let order = [1];
  let size = 1;
  while (size < P) {
    const next: number[] = [];
    const sum = size * 2 + 1;
    for (const s of order) {
      next.push(s);
      next.push(sum - s);
    }
    order = next;
    size *= 2;
  }
  return order;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Winners-bracket round label. `round` is 1-based, `totalWb` = log2(P). */
function wbLabel(round: number, totalWb: number): string {
  // Last WB round is the WB final ("Фінал В").
  if (round === totalWb) return 'Фінал В';
  // Remaining players entering this round = P / 2^(round-1); the "fraction"
  // is 1/(playersEntering/2) e.g. round1 of P=16 has 8 matches → '1/8'.
  const playersEntering = Math.pow(2, totalWb - round + 1);
  const denom = playersEntering / 2;
  return `1/${denom}`;
}

/** Losers-bracket round label. */
function lbLabel(round: number, totalLb: number): string {
  if (round === totalLb) return 'Фінал Н';
  return `Нижня R${round}`;
}

// ---------------------------------------------------------------------------
// createBracket
// ---------------------------------------------------------------------------

/**
 * Build a full double-elimination bracket from players already in seed order.
 *
 * @param players seed-ordered players (index 0 = top seed). N = players.length.
 * @param createdAt epoch ms (injected; pure).
 * @param name display name of the cup.
 */
export function createBracket(
  players: CupPlayer[],
  createdAt: number,
  name: string,
): CupState {
  const N = players.length;
  if (N < 2) throw new Error('createBracket requires at least 2 players');

  const P = nextPow2(N);
  const k = log2(P); // number of WB rounds

  const matches: CupMatch[] = [];

  const newMatch = (
    bracket: 'W' | 'L' | 'GF',
    round: number,
    slot: number,
    label: string,
  ): CupMatch => ({
    id: mkId(bracket, round, slot),
    bracket,
    round,
    slot,
    label,
    a: null,
    b: null,
    scoreA: 0,
    scoreB: 0,
    winner: null,
    status: 'pending',
    winTo: null,
    loseTo: null,
  });

  // --- Winners bracket skeleton -------------------------------------------
  // Round r (1-based) has P / 2^r matches.
  const wbRounds: CupMatch[][] = [];
  for (let r = 1; r <= k; r++) {
    const count = P / Math.pow(2, r);
    const round: CupMatch[] = [];
    for (let s = 0; s < count; s++) {
      round.push(newMatch('W', r, s, wbLabel(r, k)));
    }
    wbRounds.push(round);
  }

  // Fill WB round 1 with seeded players (phantom seeds > N => bye, b = null).
  const order = seedOrder(P); // length P, 1-based seeds per position
  const idForSeed = (seed: number): string | null =>
    seed <= N ? players[seed - 1].id : null;
  for (let s = 0; s < wbRounds[0].length; s++) {
    const seedA = order[2 * s];
    const seedB = order[2 * s + 1];
    wbRounds[0][s].a = idForSeed(seedA);
    wbRounds[0][s].b = idForSeed(seedB);
  }

  // --- Losers bracket skeleton --------------------------------------------
  // Standard LB has 2*(k-1) rounds.
  //  - "major" rounds (LB rounds 1,3,5,...) receive freshly-dropped WB losers
  //    and pair them with LB survivors.
  //  - "minor" rounds (LB rounds 2,4,...) pair LB survivors against each other.
  //
  // We build it by tracking, for each LB round, how many matches it has.
  // For k WB rounds:
  //   LB round 1: P/4 matches  (losers of WB round 1, paired together)
  //   LB round 2: P/4 matches  (LB-r1 winners vs losers of WB round 2)
  //   LB round 3: P/8 matches
  //   LB round 4: P/8 matches
  //   ... halving every two rounds, ending in 1 match (LB final).
  const totalLb = k === 1 ? 0 : 2 * (k - 1);
  const lbRounds: CupMatch[][] = [];
  if (totalLb > 0) {
    // counts: r1 = P/4, r2 = P/4, r3 = P/8, r4 = P/8, ...
    for (let r = 1; r <= totalLb; r++) {
      // group index 0,0,1,1,2,2,...
      const group = Math.floor((r - 1) / 2);
      const count = P / Math.pow(2, 2 + group);
      const round: CupMatch[] = [];
      for (let s = 0; s < count; s++) {
        round.push(newMatch('L', r, s, lbLabel(r, totalLb)));
      }
      lbRounds.push(round);
    }
  }

  // --- Grand final ---------------------------------------------------------
  const gf = newMatch('GF', 1, 0, 'ГРАНД-ФІНАЛ');

  // --- Wire WINNERS routing -----------------------------------------------
  // Winner of WB match (r, s) -> WB match (r+1, floor(s/2)) side s%2.
  // Winner of WB final -> GF side a.
  for (let r = 0; r < k; r++) {
    for (let s = 0; s < wbRounds[r].length; s++) {
      const m = wbRounds[r][s];
      if (r + 1 < k) {
        const tgt = wbRounds[r + 1][Math.floor(s / 2)];
        m.winTo = { matchId: tgt.id, side: s % 2 === 0 ? 'a' : 'b' };
      } else {
        // WB final winner -> GF side a
        m.winTo = { matchId: gf.id, side: 'a' };
      }
    }
  }

  // --- Wire LOSERS bracket internal routing & WB->LB drop routing ----------
  if (totalLb > 0) {
    // LB winner routing: winner of LB (r, s) -> LB (r+1, dest) side dest_side.
    //  - From a major round (odd r: 1,3,...) winners go to the NEXT round
    //    (a minor round) which has the SAME number of matches → side 'a'
    //    (the freshly-dropped WB loser fills side 'b').
    //    Exception: LB round 1 (the very first) is special — it pairs two WB
    //    losers, its winner goes to LB round 2.
    //  - From a minor round (even r: 2,4,...) the round halves, so winner of
    //    (r, s) -> (r+1, floor(s/2)) side s%2.
    for (let r = 1; r <= totalLb; r++) {
      const round = lbRounds[r - 1];
      const nextRound = r < totalLb ? lbRounds[r] : null;
      for (let s = 0; s < round.length; s++) {
        const m = round[s];
        if (nextRound == null) {
          // LB final winner -> GF side b
          m.winTo = { matchId: gf.id, side: 'b' };
        } else if (nextRound.length === round.length) {
          // next round is a "major" round with same width: survivor in side 'a'
          m.winTo = { matchId: nextRound[s].id, side: 'a' };
        } else {
          // next round halves: standard pairing
          m.winTo = {
            matchId: nextRound[Math.floor(s / 2)].id,
            side: s % 2 === 0 ? 'a' : 'b',
          };
        }
        // LB losers are eliminated.
        m.loseTo = null;
      }
    }

    // WB losers drop into LB. Which LB round receives which WB round's losers:
    //   WB round 1 losers  -> LB round 1 (paired together, two per match)
    //   WB round 2 losers  -> LB round 2
    //   WB round 3 losers  -> LB round 4
    //   WB round 4 losers  -> LB round 6
    //   ... WB round r (r>=2) losers -> LB round 2*(r-1).
    //
    // Cross/reversal seeding: to avoid immediate rematches, the order of WB
    // losers fed into an LB round is reversed (and on alternating rounds also
    // flipped) relative to the LB survivor order.
    for (let wr = 1; wr <= k; wr++) {
      const wbRound = wbRounds[wr - 1];
      if (wr === 1) {
        // WB round 1 losers pair up inside LB round 1.
        // LB round 1 match s takes WB-r1 losers from a reversed pairing to
        // keep R1 opponents apart: match s gets WB losers (2s) and (2s+1) but
        // sourced from opposite ends.
        const lbR1 = lbRounds[0]; // length P/4
        const Lcount = lbR1.length;
        for (let s = 0; s < Lcount; s++) {
          // Two WB-r1 matches feed each LB-r1 match. Use a reversed mapping.
          const src1 = wbRound[2 * s];
          const src2 = wbRound[2 * s + 1];
          src1.loseTo = { matchId: lbR1[s].id, side: 'a' };
          src2.loseTo = { matchId: lbR1[s].id, side: 'b' };
        }
        continue;
      }
      // WB round wr (>=2) losers drop into LB "major" round = 2*(wr-1).
      const lbMajorIdx = 2 * (wr - 1); // 1-based LB round number
      const lbMajor = lbRounds[lbMajorIdx - 1]; // same width as wbRound
      const cnt = wbRound.length; // == lbMajor.length
      // Reversal/cross seeding: reverse the slot order of the dropped losers,
      // and on alternating drop-rounds also rotate, to push apart rematches.
      for (let s = 0; s < cnt; s++) {
        // Reverse order so the WB winner who beat an LB survivor is less
        // likely to meet them again immediately.
        const reversed = cnt - 1 - s;
        // Alternate a half-rotation every other major round for extra spread.
        const useReverse = lbMajorIdx % 4 === 2;
        const targetSlot = useReverse ? reversed : s;
        wbRound[s].loseTo = { matchId: lbMajor[targetSlot].id, side: 'b' };
      }
    }
  } else {
    // k === 1: only two players, no LB. WB final (the single WB round-1 match)
    // loser drops straight to GF side b.
    wbRounds[0][0].loseTo = { matchId: gf.id, side: 'b' };
  }

  // GF has no routing.
  gf.winTo = null;
  gf.loseTo = null;

  // Collect all matches.
  for (const round of wbRounds) for (const m of round) matches.push(m);
  for (const round of lbRounds) for (const m of round) matches.push(m);
  matches.push(gf);

  const state: CupState = {
    id: `cup-${createdAt}`,
    name,
    createdAt,
    phase: 'running',
    players: players.map((p) => ({ ...p, traits: { ...p.traits } })),
    matches,
    championId: null,
    runnerUpId: null,
  };

  // Resolve all byes & propagate so opening pending matches are correct.
  propagateAll(state);

  return state;
}

// ---------------------------------------------------------------------------
// Propagation
// ---------------------------------------------------------------------------

/** Index matches by id for fast lookup (mutating helper on a working state). */
function indexMatches(state: CupState): Map<string, CupMatch> {
  const map = new Map<string, CupMatch>();
  for (const m of state.matches) map.set(m.id, m);
  return map;
}

/**
 * Place a player id into a destination match slot/side (mutates the match).
 */
function placePlayer(
  map: Map<string, CupMatch>,
  target: { matchId: string; side: Side },
  playerId: string,
): CupMatch | undefined {
  const dest = map.get(target.matchId);
  if (!dest) return undefined;
  if (target.side === 'a') dest.a = playerId;
  else dest.b = playerId;
  return dest;
}

/**
 * Auto-resolve a match that is decided WITHOUT a played game:
 *  - a bye (one side present, the other side can never be filled).
 * Returns true if it auto-resolved this call.
 *
 * A side "can never be filled" if no un-reported feeder match routes a player
 * into it. We determine fillability via the precomputed feeder map.
 */
function tryAutoResolve(
  state: CupState,
  map: Map<string, CupMatch>,
  feeders: FeederMap,
  m: CupMatch,
): boolean {
  if (m.status === 'reported') return false;
  if (m.bracket === 'GF') return false; // GF is always user-decided

  const aFilled = m.a != null;
  const bFilled = m.b != null;

  if (aFilled && bFilled) return false; // genuine match — leave pending

  if (!aFilled && !bFilled) {
    // Both sides empty. If NEITHER side can ever be filled (both feeders are
    // byes / void), this match is itself void: mark it reported with no winner
    // so downstream slots fed by it know they will never receive a player.
    const aCanFill = canStillFill(state, map, feeders, m.id, 'a');
    const bCanFill = canStillFill(state, map, feeders, m.id, 'b');
    if (!aCanFill && !bCanFill) {
      // void match — no players will ever arrive.
      m.winner = null;
      m.scoreA = 0;
      m.scoreB = 0;
      m.status = 'reported';
      return true;
    }
    return false; // at least one player still to come
  }

  // One side filled. Can the empty side still receive a player?
  const emptySide: Side = aFilled ? 'b' : 'a';
  if (canStillFill(state, map, feeders, m.id, emptySide)) {
    return false; // a player is still coming — wait
  }

  // The empty side will never be filled → auto-advance present player.
  const present = aFilled ? m.a! : m.b!;
  m.winner = present;
  m.scoreA = aFilled ? 1 : 0;
  m.scoreB = aFilled ? 0 : 1;
  m.status = 'reported';
  return true;
}

type FeederMap = {
  // For each (matchId, side) → list of feeding edges {fromMatchId, kind}.
  winInto: Map<string, { from: string }>; // key `${matchId}:${side}` win edges
  loseInto: Map<string, { from: string }>; // key `${matchId}:${side}` lose edges
};

/** Build reverse routing map: which match feeds which destination slot. */
function buildFeeders(state: CupState): FeederMap {
  const winInto = new Map<string, { from: string }>();
  const loseInto = new Map<string, { from: string }>();
  for (const m of state.matches) {
    if (m.winTo) winInto.set(`${m.winTo.matchId}:${m.winTo.side}`, { from: m.id });
    if (m.loseTo)
      loseInto.set(`${m.loseTo.matchId}:${m.loseTo.side}`, { from: m.id });
  }
  return { winInto, loseInto };
}

/**
 * Can the given (matchId, side) still receive a player in the future?
 *
 * It can iff there is a feeder edge (win or lose) into it whose source match is
 * NOT yet reported in a way that already delivered (or failed to deliver) a
 * player. Concretely:
 *  - If a feeder match is not reported → a player may still arrive.
 *  - If a feeder match IS reported but routed a real player here, the slot is
 *    already filled (so this fn wouldn't be asked). If it routed nothing
 *    (a bye loser into a loseTo edge), it never will → not fillable.
 */
function canStillFill(
  state: CupState,
  map: Map<string, CupMatch>,
  feeders: FeederMap,
  matchId: string,
  side: Side,
): boolean {
  const key = `${matchId}:${side}`;
  const winEdge = feeders.winInto.get(key);
  const loseEdge = feeders.loseInto.get(key);

  // Check the winner-feeder.
  if (winEdge) {
    const src = map.get(winEdge.from)!;
    if (src.status !== 'reported') return true; // winner still to come
    // reported: winner already routed (or being routed) here → will fill.
    // If it's already placed, the caller wouldn't ask; if not yet placed in
    // this same propagation pass it's effectively arriving → treat as fillable
    // only if winner exists (it always does for a reported match).
    if (src.winner != null) return true;
  }

  // Check the loser-feeder.
  if (loseEdge) {
    const src = map.get(loseEdge.from)!;
    if (src.status !== 'reported') return true; // a loser may still come
    // reported source: does it actually HAVE a loser?
    const loser = loserOf(src);
    if (loser != null) return true; // a real loser is arriving
    // No loser (it was itself a bye) → this slot can never be filled via lose.
  }

  return false;
}

/** Loser id of a reported match, or null (e.g. a bye has no loser). */
function loserOf(m: CupMatch): string | null {
  if (m.status !== 'reported' || m.winner == null) return null;
  if (m.a == null || m.b == null) return null; // bye → no loser
  return m.winner === m.a ? m.b : m.a;
}

/**
 * Route a freshly-reported match's winner/loser along its precomputed edges.
 * Mutates destination matches in place.
 */
function routeReported(
  state: CupState,
  map: Map<string, CupMatch>,
  m: CupMatch,
): void {
  if (m.winner == null) return;
  const loser = loserOf(m);
  if (m.winTo) placePlayer(map, m.winTo, m.winner);
  if (m.loseTo && loser != null) placePlayer(map, m.loseTo, loser);
}

/**
 * Repeatedly route all reported matches and auto-resolve byes until a fixed
 * point. Mutates `state` in place. Used after creation and after each report.
 */
function propagateAll(state: CupState): void {
  const map = indexMatches(state);
  const feeders = buildFeeders(state);

  // First, ensure every already-reported match's winner/loser is routed.
  // We iterate to a fixed point: route, then auto-resolve byes, repeat.
  let changed = true;
  // Track which reported matches we've already routed to avoid duplicate
  // placement (idempotent anyway since placement is assignment, but cheaper).
  while (changed) {
    changed = false;

    // Route every reported match (assignment is idempotent).
    for (const m of state.matches) {
      if (m.status === 'reported' && m.winner != null) {
        // Capture destination contents before to detect change.
        const beforeWin = m.winTo
          ? sideVal(map.get(m.winTo.matchId), m.winTo.side)
          : undefined;
        const loser = loserOf(m);
        const beforeLose =
          m.loseTo && loser != null
            ? sideVal(map.get(m.loseTo.matchId), m.loseTo.side)
            : undefined;
        routeReported(state, map, m);
        const afterWin = m.winTo
          ? sideVal(map.get(m.winTo.matchId), m.winTo.side)
          : undefined;
        const afterLose =
          m.loseTo && loser != null
            ? sideVal(map.get(m.loseTo.matchId), m.loseTo.side)
            : undefined;
        if (beforeWin !== afterWin || beforeLose !== afterLose) changed = true;
      }
    }

    // Auto-resolve byes (matches decided without a played game).
    for (const m of state.matches) {
      if (tryAutoResolve(state, map, feeders, m)) changed = true;
    }
  }

  // Finalize: if GF reported, set champion/runnerUp/phase.
  const gf = state.matches.find((x) => x.bracket === 'GF');
  if (gf && gf.status === 'reported' && gf.winner != null) {
    state.championId = gf.winner;
    state.runnerUpId = gf.winner === gf.a ? gf.b : gf.a;
    state.phase = 'done';
  }
}

/** Value of a match side (or undefined if match missing). */
function sideVal(m: CupMatch | undefined, side: Side): string | null | undefined {
  if (!m) return undefined;
  return side === 'a' ? m.a : m.b;
}

// ---------------------------------------------------------------------------
// reportResult
// ---------------------------------------------------------------------------

/**
 * Report a played match result. Pure: returns a NEW CupState.
 *
 * @throws if the match is unknown, either side is empty, scores are equal, or
 *   the match is already reported.
 */
export function reportResult(
  state: CupState,
  matchId: string,
  scoreA: number,
  scoreB: number,
): CupState {
  const next = cloneState(state);
  const map = indexMatches(next);
  const m = map.get(matchId);
  if (!m) throw new Error(`Unknown matchId: ${matchId}`);
  if (m.a == null || m.b == null)
    throw new Error(`Match ${matchId} is not ready (a/b not both set)`);
  if (scoreA === scoreB)
    throw new Error(`Scores must differ (got ${scoreA}-${scoreB})`);
  if (m.status === 'reported')
    throw new Error(`Match ${matchId} already reported`);

  m.scoreA = scoreA;
  m.scoreB = scoreB;
  m.winner = scoreA > scoreB ? m.a : m.b;
  m.status = 'reported';

  propagateAll(next);
  return next;
}

// ---------------------------------------------------------------------------
// resetResult
// ---------------------------------------------------------------------------

/**
 * Clear a reported result and everything downstream that depended on it.
 *
 * Pure: returns a NEW CupState. We recompute the entire bracket forward from
 * the set of results that should remain. A result is removed iff it is the
 * target match OR it is (transitively) downstream of the target match through
 * win/lose routing edges. Auto-resolved byes are always recomputed.
 *
 * @throws if the match is unknown or not reported.
 */
export function resetResult(state: CupState, matchId: string): CupState {
  const target = state.matches.find((m) => m.id === matchId);
  if (!target) throw new Error(`Unknown matchId: ${matchId}`);
  if (target.status !== 'reported')
    throw new Error(`Match ${matchId} is not reported`);

  // Compute the set of matchIds that are downstream of `matchId` (inclusive).
  const downstream = new Set<string>([matchId]);
  const byId = new Map(state.matches.map((m) => [m.id, m] as const));
  let grew = true;
  while (grew) {
    grew = false;
    for (const m of state.matches) {
      if (downstream.has(m.id)) {
        for (const edge of [m.winTo, m.loseTo]) {
          if (edge && !downstream.has(edge.matchId)) {
            downstream.add(edge.matchId);
            grew = true;
          }
        }
      }
    }
  }

  // Determine which reported results to KEEP: those NOT downstream and NOT
  // auto-resolved byes (byes get recomputed by propagateAll). We keep
  // genuine, user-entered results that are upstream/independent.
  const keep = new Map<string, { scoreA: number; scoreB: number }>();
  for (const m of state.matches) {
    if (m.status !== 'reported') continue;
    if (downstream.has(m.id)) continue;
    const isBye = m.a == null || m.b == null;
    if (isBye) continue; // recomputed
    keep.set(m.id, { scoreA: m.scoreA, scoreB: m.scoreB });
  }

  // Rebuild from a clean skeleton (same structure), then re-apply kept results
  // in a stable order, propagating after each.
  const fresh = cloneState(state);
  // Reset every match to pending/empty except round-1 WB seeds (the only
  // intrinsic data). We reconstruct by clearing all and re-seeding round-1.
  for (const m of fresh.matches) {
    m.scoreA = 0;
    m.scoreB = 0;
    m.winner = null;
    m.status = 'pending';
    // Clear all slots EXCEPT WB round-1 (the seeded entry points).
    if (!(m.bracket === 'W' && m.round === 1)) {
      m.a = null;
      m.b = null;
    }
  }
  fresh.championId = null;
  fresh.runnerUpId = null;
  fresh.phase = 'running';

  // Propagate byes from the seeded round-1 first.
  propagateAll(fresh);

  // Re-apply kept results until no more can be applied (order-independent via
  // repeated passes — a result becomes applicable once its match is filled).
  let appliedSomething = true;
  const applied = new Set<string>();
  while (appliedSomething) {
    appliedSomething = false;
    const map = indexMatches(fresh);
    for (const [id, sc] of keep) {
      if (applied.has(id)) continue;
      const m = map.get(id);
      if (!m) continue;
      if (m.status === 'reported') {
        // already auto-resolved (shouldn't happen for genuine matches)
        applied.add(id);
        continue;
      }
      if (m.a != null && m.b != null) {
        m.scoreA = sc.scoreA;
        m.scoreB = sc.scoreB;
        m.winner = sc.scoreA > sc.scoreB ? m.a : m.b;
        m.status = 'reported';
        propagateAll(fresh);
        applied.add(id);
        appliedSomething = true;
      }
    }
  }

  void byId; // (kept for potential future validation)
  return fresh;
}

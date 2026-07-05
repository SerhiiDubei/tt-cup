import type { Player, Match } from './types';
import { computeStandings } from './standings';

/**
 * A bye is recorded as a best-of-5 sweep (3-0) auto-win for the bye player.
 * Mirrors the scoring convention used by {@link computeStandings} and the
 * spec §10 ("bye = авто-перемога (3:0)").
 */
const BYE_SETS: Match['sets'] = [
  [11, 0],
  [11, 0],
  [11, 0],
];

/** Stable key for an unordered pair of player ids. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Build the set of player-pair keys that have already been played (in any
 * reported or pending swiss match). Bye matches (`b === null`) are skipped —
 * they do not establish an opponent relationship.
 */
function playedPairs(matches: Match[]): Set<string> {
  const seen = new Set<string>();
  for (const m of matches) {
    if (m.b == null) continue;
    seen.add(pairKey(m.a, m.b));
  }
  return seen;
}

/** Set of player ids who have already received a bye in a previous round. */
function priorByes(matches: Match[]): Set<string> {
  const byes = new Set<string>();
  for (const m of matches) {
    if (m.stage === 'swiss' && m.b == null) byes.add(m.a);
  }
  return byes;
}

/**
 * Order players for pairing.
 *
 * - Round 1: by `seed` ascending (lower seed number = stronger). Ties broken by
 *   name for determinism.
 * - Later rounds: by current standings (points → Buchholz → set diff → name),
 *   so players with similar records meet — the core Swiss property.
 */
function orderPlayers(
  players: Player[],
  matches: Match[],
  roundNo: number,
): Player[] {
  if (roundNo <= 1) {
    return [...players].sort((a, b) => {
      if (a.seed !== b.seed) return a.seed - b.seed;
      return a.name.localeCompare(b.name);
    });
  }
  return computeStandings(players, matches).map((row) => row.player);
}

/**
 * Pick the bye recipient for an odd field: the player lowest in the ordering
 * (worst standing / highest seed) who has **not** already had a bye. If every
 * remaining player has already had a bye (degenerate fallback), the lowest one
 * overall is chosen so the round can still be formed.
 *
 * @param ordered players in pairing order (strongest first, weakest last)
 * @returns the chosen player and the remaining players (order preserved)
 */
function pickBye(
  ordered: Player[],
  hadBye: Set<string>,
): { byePlayer: Player; rest: Player[] } {
  // Walk from the bottom up; first player without a prior bye wins it.
  let chosenIndex = -1;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (!hadBye.has(ordered[i].id)) {
      chosenIndex = i;
      break;
    }
  }
  // Fallback: everyone has had a bye already -> give it to the lowest standing.
  if (chosenIndex === -1) chosenIndex = ordered.length - 1;

  const byePlayer = ordered[chosenIndex];
  const rest = ordered.filter((_, i) => i !== chosenIndex);
  return { byePlayer, rest };
}

/**
 * Pair an even pool with **zero rematches if and only if that is possible**,
 * otherwise with the minimum number of rematches, while keeping the Swiss
 * preference of pairing players who are near each other in the ordering.
 *
 * Why not a simple greedy first-fit? A single forward pass ("each player takes
 * the nearest valid opponent") can strand the tail into a rematch even when a
 * rematch-free pairing of the whole pool exists — it makes a locally-valid
 * choice that globally paints itself into a corner. This bites in practice: a
 * full 16-player / 8-round event (the maximum rematch-free Swiss schedule) and
 * many ordinary mid-event states. So we backtrack.
 *
 * Strategy: recursive matching that always pairs the **first** unpaired player
 * (preserving "top of the ordering goes first") with candidate partners tried
 * **nearest-first**. Each attempt is scored by the number of rematches it
 * forces; we prune as soon as we find a 0-rematch solution and otherwise keep
 * the minimum. The search is bounded (best-known cost prunes branches) so it
 * terminates quickly for tournament-sized fields.
 *
 * @returns array of `[indexA, indexB]` into `pool`, A always the earlier index.
 */
function matchPool(pool: Player[], played: Set<string>): Array<[number, number]> {
  const n = pool.length;
  const used = new Array<boolean>(n).fill(false);
  const current: Array<[number, number]> = [];

  let best: Array<[number, number]> | null = null;
  let bestCost = Infinity;

  const isRematch = (i: number, j: number): number =>
    played.has(pairKey(pool[i].id, pool[j].id)) ? 1 : 0;

  const search = (costSoFar: number): void => {
    if (best !== null && costSoFar >= bestCost) return; // prune

    // Find the first unpaired player (keeps ordering preference).
    let i = -1;
    for (let k = 0; k < n; k++) {
      if (!used[k]) {
        i = k;
        break;
      }
    }
    if (i === -1) {
      // Complete matching.
      best = current.map((p) => [p[0], p[1]] as [number, number]);
      bestCost = costSoFar;
      return;
    }

    used[i] = true;
    // Try partners nearest-first (Swiss preference) — j ascending from i+1.
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const add = isRematch(i, j);
      if (best !== null && costSoFar + add >= bestCost) continue; // prune
      used[j] = true;
      current.push([i, j]);
      search(costSoFar + add);
      current.pop();
      used[j] = false;
      if (bestCost === 0) break; // optimal found; stop exploring partners
    }
    used[i] = false;
  };

  search(0);
  return best ?? [];
}

/**
 * Generate the matches for a single Swiss round.
 *
 * Algorithm (spec §10):
 * 1. Order players by seed (round 1) or current standings (later rounds).
 * 2. If the field is odd, remove one player for a bye — the lowest-standing
 *    player who has not had a bye yet — and emit an auto-win (3-0) bye match.
 * 3. Pair the remaining players preferring nearest-in-standings opponents they
 *    have **not** already faced, via {@link matchPool} (backtracking matching
 *    that guarantees a rematch-free round whenever one exists).
 * 4. Dead-end fallback: if no rematch-free pairing exists, {@link matchPool}
 *    returns the minimum-rematch pairing instead — a rematch is preferred over
 *    no round. Spec §10: "краще повтор, ніж нема туру".
 *
 * Pure function: it does not mutate its inputs. Returned matches are `pending`
 * (except byes, which are `reported`) with empty sets and ascending `slot`s.
 *
 * @param players  all tournament players
 * @param matches  prior matches (used for standings + rematch avoidance)
 * @param roundNo  1-based round number; controls ordering + the `round` label
 */
export function generateSwissRound(
  players: Player[],
  matches: Match[],
  roundNo: number,
): Match[] {
  if (players.length === 0) return [];

  const ordered = orderPlayers(players, matches, roundNo);
  const played = playedPairs(matches);
  const hadBye = priorByes(matches);

  const roundLabel = String(roundNo);
  const result: Match[] = [];
  let slot = 0;

  // Working pool of players still needing a pairing.
  let pool = ordered;

  // Odd field -> carve out a bye first.
  if (pool.length % 2 === 1) {
    const { byePlayer, rest } = pickBye(pool, hadBye);
    result.push({
      id: `swiss-r${roundLabel}-bye-${byePlayer.id}`,
      stage: 'swiss',
      round: roundLabel,
      slot: slot++,
      a: byePlayer.id,
      b: null,
      seed_a: byePlayer.seed,
      seed_b: null,
      sets: BYE_SETS.map((s) => [s[0], s[1]] as [number, number]),
      winner: byePlayer.id,
      status: 'reported',
    });
    pool = rest;
  }

  // Backtracking matching over the remaining (even) pool: rematch-free when
  // possible, otherwise minimum-rematch.
  const pairs = matchPool(pool, played);
  for (const [i, j] of pairs) {
    const a = pool[i];
    const b = pool[j];
    result.push({
      id: `swiss-r${roundLabel}-s${slot}-${a.id}-${b.id}`,
      stage: 'swiss',
      round: roundLabel,
      slot: slot++,
      a: a.id,
      b: b.id,
      seed_a: a.seed,
      seed_b: b.seed,
      sets: [],
      winner: null,
      status: 'pending',
    });
  }

  return result;
}

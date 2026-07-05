import type { Player, Match } from './types';
import { computeStandings } from './standings';

/**
 * Standard single-elimination top-8 seeding (spec §10).
 *
 * Pairs are expressed as 1-based bracket seeds. Reading the four quarter-finals
 * top to bottom gives `1-8, 4-5, 2-7, 3-6`, which keeps the #1 and #2 seeds on
 * opposite halves of the bracket so they can only meet in the final.
 */
export const SEED_PAIRS: [number, number][] = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
];

const QF = 'QF';
const SF = 'SF';
const F = 'F';
const BR = 'BR';

/**
 * Number of players that enter the playoff bracket.
 */
export const PLAYOFF_SIZE = 8;

/** A freshly-created, unplayed playoff match. */
function newMatch(
  round: string,
  slot: number,
  a: string,
  b: string,
  seed_a: number | null,
  seed_b: number | null,
): Match {
  return {
    id: `${round}-${slot}`,
    stage: 'playoff',
    round,
    slot,
    a,
    b,
    seed_a,
    seed_b,
    sets: [],
    winner: null,
    status: 'pending',
  };
}

/**
 * Seed the top-8 quarter-finals from the swiss standings (spec §10).
 *
 * The eight best-placed players (by {@link computeStandings}) are taken in
 * finishing order and assigned bracket seeds 1..8. They are then paired
 * according to {@link SEED_PAIRS} into four pending QF matches.
 *
 * Pure function: it does not mutate its inputs.
 *
 * @returns four pending QF {@link Match} objects (slots 0..3), or an empty
 *   array if fewer than {@link PLAYOFF_SIZE} players exist.
 */
export function seedPlayoff(players: Player[], matches: Match[]): Match[] {
  const standings = computeStandings(players, matches);
  if (standings.length < PLAYOFF_SIZE) return [];

  // Bracket seed (1-based) -> player id.
  const bySeed = standings.slice(0, PLAYOFF_SIZE).map((row) => row.id);
  const idForSeed = (seed: number) => bySeed[seed - 1];

  return SEED_PAIRS.map(([seedA, seedB], slot) =>
    newMatch(QF, slot, idForSeed(seedA), idForSeed(seedB), seedA, seedB),
  );
}

/** All playoff matches for a given round. */
function roundMatches(matches: Match[], round: string): Match[] {
  return matches
    .filter((m) => m.stage === 'playoff' && m.round === round)
    .sort((x, y) => x.slot - y.slot);
}

/** True when every supplied match has a reported winner. */
function allReported(ms: Match[]): boolean {
  return ms.length > 0 && ms.every((m) => m.status === 'reported' && m.winner != null);
}

/** Winner of a reported match, or null. */
function winnerOf(m: Match): string | null {
  return m.status === 'reported' ? m.winner : null;
}

/** The losing side of a reported match (the player who is not the winner). */
function loserOf(m: Match): string | null {
  if (m.status !== 'reported' || m.winner == null) return null;
  return m.winner === m.a ? (m.b as string) : m.a;
}

/**
 * Advance the playoff to its next stage based on the current matches.
 *
 * Progression (spec §10): QF -> SF -> (F + BR), where
 * - **SF** pairs the four QF winners: (QF0 winner vs QF1 winner) and
 *   (QF2 winner vs QF3 winner).
 * - **F** is contested by the two SF winners; **BR** (bronze, match for 3rd
 *   place) by the two SF losers.
 *
 * Generation is gated on completion: a round is only advanced once *all* of its
 * matches are reported. If the current round is incomplete, or the final round
 * (F + BR) already exists, an empty array is returned.
 *
 * Pure function: it does not mutate its inputs.
 *
 * @returns the newly-created pending matches for the next stage, or `[]`.
 */
export function advancePlayoff(_players: Player[], matches: Match[]): Match[] {
  const qf = roundMatches(matches, QF);
  const sf = roundMatches(matches, SF);
  const fbr = [...roundMatches(matches, F), ...roundMatches(matches, BR)];

  // Final stage already generated -> nothing left to create.
  if (fbr.length > 0) return [];

  // SF complete and Final/Bronze not yet created -> build F + BR.
  if (allReported(sf) && sf.length === 2) {
    const [sf0, sf1] = sf;
    const winA = winnerOf(sf0)!;
    const winB = winnerOf(sf1)!;
    const losA = loserOf(sf0)!;
    const losB = loserOf(sf1)!;
    return [
      newMatch(F, 0, winA, winB, null, null),
      newMatch(BR, 0, losA, losB, null, null),
    ];
  }

  // QF complete and SF not yet created -> build the two semi-finals.
  if (sf.length === 0 && allReported(qf) && qf.length === 4) {
    const [q0, q1, q2, q3] = qf;
    return [
      newMatch(SF, 0, winnerOf(q0)!, winnerOf(q1)!, null, null),
      newMatch(SF, 1, winnerOf(q2)!, winnerOf(q3)!, null, null),
    ];
  }

  // Current round incomplete (or nothing to do).
  return [];
}

/**
 * The tournament champion: the winner of the Final (`round === 'F'`), or
 * `null` if the Final does not exist or has not been reported.
 */
export function champion(matches: Match[]): string | null {
  const final = matches.find((m) => m.stage === 'playoff' && m.round === F);
  return final ? winnerOf(final) : null;
}

/**
 * The bronze medalist: the winner of the third-place match (`round === 'BR'`),
 * or `null` if that match does not exist or has not been reported.
 */
export function bronze(matches: Match[]): string | null {
  const br = matches.find((m) => m.stage === 'playoff' && m.round === BR);
  return br ? winnerOf(br) : null;
}

import type { Player, Match } from './types';
import { gamesFromSets } from './scoring';

/**
 * A single computed row of the tournament standings table.
 *
 * Points/wins/games are derived from reported **swiss** matches only;
 * playoff matches and unreported (pending) matches are ignored.
 */
export type Standing = {
  /** Player id (same as {@link Player.id}). */
  id: string;
  /** The full player object, for convenient rendering. */
  player: Player;
  /** Tournament points — 1 per match win (spec §10). */
  points: number;
  /** Number of matches won. */
  wins: number;
  /** Number of matches lost. */
  losses: number;
  /** Games (sets) won across all counted matches. */
  gw: number;
  /** Games (sets) lost across all counted matches. */
  gl: number;
  /** Game/set difference, `gw - gl`. */
  gd: number;
  /** Buchholz score — the sum of the points of every opponent faced. */
  buchholz: number;
  /** Ids of opponents faced (excludes byes, where `b` is null). */
  opponents: string[];
};

const POINTS_PER_WIN = 1;

/** Гравці, що беруть участь у турнірі (кіоскові casual-гравці не рахуються). */
export const tournamentPlayers = (players: Player[]) =>
  players.filter((p) => !p.casual);

/**
 * Compute the sorted standings table from the players and the match history.
 *
 * Counting rules (spec §10):
 * - Only `stage === 'swiss'` matches with `status === 'reported'` count.
 * - Each match win is worth {@link POINTS_PER_WIN} point.
 * - Games won/lost come from the set scores via {@link gamesFromSets}.
 * - Byes (`b === null`) still award the win/point to player `a` but add no
 *   opponent and contribute nothing to anyone else's Buchholz.
 * - Matches referencing ids that are not in `players` are tolerated: the known
 *   player still gets credited; the unknown id is simply not a row.
 * - Casual (kiosk queue) players are excluded entirely (see {@link tournamentPlayers}).
 *
 * Sorting (descending priority, spec §10):
 *   points → Buchholz → set difference (gd) → name (ascending, deterministic).
 *
 * Pure function: it does not mutate its inputs.
 */
export function computeStandings(
  players: Player[],
  matches: Match[],
): Standing[] {
  // Seed one row per known (tournament, non-casual) player.
  const rows = new Map<string, Standing>();
  for (const player of tournamentPlayers(players)) {
    rows.set(player.id, {
      id: player.id,
      player,
      points: 0,
      wins: 0,
      losses: 0,
      gw: 0,
      gl: 0,
      gd: 0,
      buchholz: 0,
      opponents: [],
    });
  }

  // Only reported swiss matches contribute to standings.
  const counted = matches.filter(
    (m) => m.stage === 'swiss' && m.status === 'reported',
  );

  for (const m of counted) {
    const [gamesA, gamesB] = gamesFromSets(m.sets);
    const rowA = rows.get(m.a);
    const rowB = m.b != null ? rows.get(m.b) : undefined;

    // Credit side A (if a known player).
    if (rowA) {
      rowA.gw += gamesA;
      rowA.gl += gamesB;
      if (m.b != null) rowA.opponents.push(m.b);
      if (m.winner === m.a) {
        rowA.wins += 1;
        rowA.points += POINTS_PER_WIN;
      } else if (m.winner != null) {
        rowA.losses += 1;
      }
    }

    // Credit side B (if present and a known player).
    if (rowB && m.b != null) {
      rowB.gw += gamesB;
      rowB.gl += gamesA;
      rowB.opponents.push(m.a);
      if (m.winner === m.b) {
        rowB.wins += 1;
        rowB.points += POINTS_PER_WIN;
      } else if (m.winner != null) {
        rowB.losses += 1;
      }
    }
  }

  // Finalise game difference now that gw/gl are settled.
  for (const row of rows.values()) {
    row.gd = row.gw - row.gl;
  }

  // Buchholz = sum of opponents' points (computed after points are known).
  for (const row of rows.values()) {
    row.buchholz = row.opponents.reduce(
      (sum, oppId) => sum + (rows.get(oppId)?.points ?? 0),
      0,
    );
  }

  // Sort: points → Buchholz → set difference → name (asc) → id (asc).
  // The final `id` comparison guarantees a deterministic order even when two
  // players share the exact same name (localeCompare would otherwise return 0
  // and leave ordering dependent on input/engine).
  return [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.buchholz !== x.buchholz) return y.buchholz - x.buchholz;
    if (y.gd !== x.gd) return y.gd - x.gd;
    const byName = x.player.name.localeCompare(y.player.name);
    if (byName !== 0) return byName;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

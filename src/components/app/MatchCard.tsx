'use client';

import type { Match, Player } from '@/lib/tournament/types';
import { gamesFromSets } from '@/lib/tournament/scoring';

/** Look up a player by id within a list. */
function findPlayer(players: Player[], id: string | null | undefined): Player | undefined {
  if (id == null) return undefined;
  return players.find((p) => p.id === id);
}

/** First letter of a name, uppercased, for the avatar bubble. */
function initialOf(name: string | undefined): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/** Human label for a match round: 'ТУР N' for swiss, named stages for playoff. */
const PLAYOFF_LABEL: Record<string, string> = {
  QF: '1/4',
  SF: '1/2',
  F: 'ФІНАЛ',
  BR: 'ЗА 3-ТЄ',
};
function roundLabel(match: Match): string {
  if (match.stage === 'swiss') return `ТУР ${match.round}`;
  return PLAYOFF_LABEL[match.round] ?? match.round;
}

/** One side (player) of a versus card. `bye` renders a placeholder. */
function Side({ player, bye }: { player?: Player; bye?: boolean }) {
  if (bye) {
    return (
      <div className="vs-side">
        <div className="vs-av" style={{ opacity: 0.5 }}>
          —
        </div>
        <div style={{ fontWeight: 700 }}>BYE</div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>автоперемога</div>
      </div>
    );
  }
  const name = player?.name ?? 'Невідомо';
  const color = player?.hero?.color || 'var(--yellow)';
  return (
    <div className="vs-side">
      <div
        className="vs-av"
        style={{ background: color, fontFamily: 'var(--font-display)', fontWeight: 900 }}
      >
        {initialOf(player?.name)}
      </div>
      <div style={{ fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>@{player?.nickname ?? '???'}</div>
    </div>
  );
}

/**
 * Render a single {@link Match} as a Memphis `.vs-card`.
 *
 * - Two `.vs-side` columns (avatar initial in hero colour, name, @nick).
 * - The middle `.vs-mid` shows the round label and, when reported, the games
 *   tally via {@link gamesFromSets}; otherwise a 'НЕ ЗІГРАНО' chip.
 * - The card gets `.mine` when `mineId` matches either side.
 * - A compact 'Вписати рахунок' button appears when `onEnter` is provided and
 *   the match is still pending and has a real opponent.
 * - Byes (`b === null`) render gracefully as an auto-win placeholder.
 */
export default function MatchCard({
  match,
  players,
  mineId,
  onEnter,
}: {
  match: Match;
  players: Player[];
  mineId?: string;
  onEnter?: (m: Match) => void;
}) {
  const playerA = findPlayer(players, match.a);
  const playerB = findPlayer(players, match.b);
  const isBye = match.b == null;
  const reported = match.status === 'reported';
  const mine = mineId != null && (match.a === mineId || match.b === mineId);

  const [gamesA, gamesB] = gamesFromSets(match.sets);
  const canEnter = !!onEnter && !reported && !isBye;

  return (
    <div className={`vs-card${mine ? ' mine' : ''}`}>
      <Side player={playerA} />

      <div className="vs-mid">
        <div>{roundLabel(match)}</div>
        {reported ? (
          <div className="score-big">
            {gamesA}:{gamesB}
          </div>
        ) : isBye ? (
          <span className="chip win" style={{ marginTop: 8 }}>
            АВТОПРОХІД
          </span>
        ) : (
          <span className="chip" style={{ marginTop: 8 }}>
            НЕ ЗІГРАНО
          </span>
        )}
        {canEnter && (
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn pink"
              style={{ fontSize: 13, padding: '9px 16px' }}
              onClick={() => onEnter!(match)}
            >
              Вписати рахунок
            </button>
          </div>
        )}
      </div>

      <Side player={playerB} bye={isBye} />
    </div>
  );
}

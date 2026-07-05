'use client';

import { useState } from 'react';
import type { Match, Player, SetScore } from '@/lib/tournament/types';
import { gamesFromSets, setsValid } from '@/lib/tournament/scoring';
import { reportScore } from '@/lib/api';

const MAX_SETS = 5;

/** Look up a player by id within a list. */
function findPlayer(players: Player[], id: string | null | undefined): Player | undefined {
  if (id == null) return undefined;
  return players.find((p) => p.id === id);
}

/** Build the initial editable grid from a match's existing sets (best-of-5). */
function initialRows(match: Match): [string, string][] {
  const rows: [string, string][] = Array.from({ length: MAX_SETS }, () => ['', '']);
  match.sets.forEach(([x, y], i) => {
    if (i < MAX_SETS) rows[i] = [String(x), String(y)];
  });
  return rows;
}

/** Turn the editable string grid into SetScore tuples, dropping empty rows. */
function rowsToSets(rows: [string, string][]): SetScore[] {
  const sets: SetScore[] = [];
  for (const [a, b] of rows) {
    if (a.trim() === '' && b.trim() === '') continue;
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sets.push([x, y]);
  }
  return sets;
}

/**
 * Modal for entering a best-of-5 result, set by set.
 *
 * Renders five rows of two small number inputs, shows a live games tally via
 * {@link gamesFromSets}, validates with {@link setsValid}, then calls
 * {@link reportScore}. On success it calls `onDone`; on failure it surfaces the
 * error message inline.
 */
export default function ScoreModal({
  match,
  players,
  token,
  onClose,
  onDone,
}: {
  match: Match;
  players: Player[];
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<[string, string][]>(() => initialRows(match));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerA = findPlayer(players, match.a);
  const playerB = findPlayer(players, match.b);

  const sets = rowsToSets(rows);
  const [gamesA, gamesB] = gamesFromSets(sets);
  const valid = setsValid(sets);

  function setCell(row: number, col: 0 | 1, value: string) {
    setRows((prev) => {
      const next = prev.map((r) => [...r] as [string, string]);
      next[row][col] = value;
      return next;
    });
  }

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await reportScore(token, match.id, sets);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти рахунок');
      setSaving(false);
    }
  }

  const cellInput = {
    width: 56,
    textAlign: 'center' as const,
    padding: '9px 8px',
    fontSize: 16,
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card">
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 6,
            }}
          >
            Рахунок матчу
          </h3>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 18 }}>
            {(playerA?.name ?? 'Гравець A')} проти {(playerB?.name ?? 'Гравець B')} · до 3 партій
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 1fr',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span />
            <span style={{ fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              {playerA?.name ?? 'A'}
            </span>
            <span style={{ fontWeight: 700, fontSize: 13, textAlign: 'center' }}>
              {playerB?.name ?? 'B'}
            </span>

            {rows.map((row, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <span style={{ fontWeight: 700, fontSize: 12, opacity: 0.55 }}>{i + 1}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  style={cellInput}
                  value={row[0]}
                  onChange={(e) => setCell(i, 0, e.target.value)}
                  aria-label={`Партія ${i + 1}, рахунок A`}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  style={cellInput}
                  value={row[1]}
                  onChange={(e) => setCell(i, 1, e.target.value)}
                  aria-label={`Партія ${i + 1}, рахунок B`}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <span className="chip">Партії</span>
            <span className="score-big">
              {gamesA}:{gamesB}
            </span>
          </div>

          {error && (
            <p style={{ color: 'var(--coral)', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
              Скасувати
            </button>
            <button type="button" className="btn pink" onClick={save} disabled={!valid || saving}>
              {saving ? 'Збереження…' : 'Зберегти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

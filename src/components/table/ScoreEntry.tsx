'use client';
import { useEffect, useRef, useState } from 'react';
import type { Player, SetScore } from '@/lib/tournament/types';
import { validateSets, casualWinner, type SetsError } from '@/lib/table/scoring';

const DEFAULT_SET: SetScore = [11, 9];
const MAX = 99;

const HINT: Record<SetsError, string> = {
  no_sets: 'Додай хоча б один сет',
  bad_points: 'Перевір цифри — щось дивне',
  set_tied: 'У сеті нічиєї не буває — додай очко комусь',
  match_tied: 'Порівну сетів — потрібен вирішальний',
};

/** Кнопка степера з утриманням (hold-to-repeat). Тільки pointer-події. */
// Навмисно без keyboard-активації (onClick/onKeyDown) — це тач-кіоск, клавіатури немає.
function StepBtn({ label, onStep, disabled, className }: {
  label: string; onStep: () => void; disabled?: boolean; className?: string;
}) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (t.current) { clearTimeout(t.current); t.current = null; }
    if (iv.current) { clearInterval(iv.current); iv.current = null; }
  };
  useEffect(() => stop, []);
  return (
    <button
      className={'k-step ' + (className ?? '')} disabled={disabled} aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); onStep(); t.current = setTimeout(() => { iv.current = setInterval(onStep, 110); }, 480); }}
      onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
    >{label}</button>
  );
}

export default function ScoreEntry({ a, b, onSubmit, onCancel }: {
  a: Player; b: Player;
  onSubmit: (sets: SetScore[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [sets, setSets] = useState<SetScore[]>([[...DEFAULT_SET]]);
  const [pending, setPending] = useState(false);

  const err = validateSets(sets);
  const winner = err === null ? (casualWinner(a.id, b.id, sets) === a.id ? a : b) : null;

  const bump = (i: number, side: 0 | 1, d: 1 | -1) =>
    setSets((prev) => prev.map((s, j) => {
      if (j !== i) return s;
      const next: SetScore = [...s];
      next[side] = Math.min(MAX, Math.max(0, next[side] + d));
      return next;
    }));

  const addSet = () => setSets((prev) => [...prev, [...DEFAULT_SET]]);
  const removeSet = (i: number) => setSets((prev) => prev.filter((_, j) => j !== i));

  async function submit() {
    if (pending || err !== null) return;
    setPending(true);
    try { await onSubmit(sets); } finally { setPending(false); }
  }

  return (
    <div className="k-scrim" role="dialog" aria-modal="true" aria-label="Рахунок гри">
      <div className="k-sheet k-score">
        <div className="k-sheet-head">
          <h2>РАХУНОК</h2>
          <span className="k-sheet-hint">по сетах</span>
          <button className="k-close" onClick={onCancel} aria-label="Назад без збереження">✕</button>
        </div>

        <div className="k-score-body">
          <div className="k-score-names">
            <span className="pa">{a.nickname || a.name}</span>
            <span className="mid" />
            <span className="pb">{b.nickname || b.name}</span>
          </div>

          <div className="k-sets">
            {sets.map((s, i) => (
              <div className="k-set" key={i}>
                <span className="k-set-n">СЕТ {i + 1}</span>
                <div className="k-stepper">
                  <StepBtn label="−" onStep={() => bump(i, 0, -1)} disabled={pending} />
                  <span className="k-pts">{s[0]}</span>
                  <StepBtn label="+" onStep={() => bump(i, 0, 1)} disabled={pending} className="plus" />
                </div>
                <span className="k-colon">:</span>
                <div className="k-stepper">
                  <StepBtn label="−" onStep={() => bump(i, 1, -1)} disabled={pending} />
                  <span className="k-pts">{s[1]}</span>
                  <StepBtn label="+" onStep={() => bump(i, 1, 1)} disabled={pending} className="plus" />
                </div>
                <button className="k-set-x" disabled={pending} aria-label={`Прибрати сет ${i + 1}`} onClick={() => removeSet(i)}>✕</button>
              </div>
            ))}
            <button className="kbtn lg k-addset" disabled={pending} onClick={addSet}>+ СЕТ</button>
          </div>
        </div>

        <footer className="k-sheet-foot">
          <div className="k-sel-line">
            {winner
              ? <>Переміг: <b>{winner.nickname || winner.name}</b></>
              : <i>{HINT[err as SetsError]}</i>}
          </div>
          <button className="kbtn lg" onClick={onCancel} disabled={pending}>НАЗАД</button>
          <button className="kbtn xl pink k-confirm" disabled={pending || err !== null} onClick={() => { void submit(); }}>
            {pending ? 'ЗБЕРІГАЮ…' : 'ЗАВЕРШИТИ'}
          </button>
        </footer>
      </div>
    </div>
  );
}

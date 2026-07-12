'use client';
import { useEffect, useRef, useState } from 'react';
import type { Player, SetScore } from '@/lib/tournament/types';
import {
  validateSets, casualWinner, quickSets, quickDefaultLoser, quickWinnerPts,
  QUICK_TARGETS, type QuickTarget, type SetsError,
} from '@/lib/table/scoring';
import HeroArt from '@/components/HeroArt';
import { NickFit, PodiumCrown, byGender } from '@/components/table/bits';

const DEFAULT_SET: SetScore = [11, 9];
const MAX = 99;

/** Стеля степпера очок переможеного: понад target-2 — дюсовий рахунок (l+2:l). */
const QUICK_LOSER_MAX = 29;

const HINT: Record<SetsError, string> = {
  no_sets: 'Додай хоча б один сет',
  bad_points: 'Перевір цифри — щось дивне',
  set_tied: 'У сеті нічиєї не буває — додай очко комусь',
  bad_set_score: 'Такого рахунку не буває: сет — до 11 або до 21, дюси з різницею 2 (12:10, 22:20…)',
  match_tied: 'Порівну сетів — потрібен вирішальний',
};

/** Цифра рахунку, що «стрибає як м'яч» при зміні: + — приземлення (сплющення),
    − — підліт (розтяг). WAAPI самозавершна, reduced-motion — без стрибка. */
function Pts({ v }: { v: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(v);
  useEffect(() => {
    if (prev.current === v) return;
    const up = v > prev.current;
    prev.current = v;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ref.current?.animate([
      { transform: 'scale(1,1)' },
      { transform: up ? 'scale(1.22,.76) translateY(3px)' : 'scale(.82,1.16) translateY(-3px)', offset: .4 },
      { transform: 'scale(1,1)' },
    ], { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' });
  }, [v]);
  return <span className="k-pts" ref={ref}>{v}</span>;
}

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

/**
 * Ввід рахунку у два режими з ОДНИМ контрактом onSubmit(sets a:b):
 * — 'quick' (дефолт, клуб грає один сет до 11/21): «ХТО ПЕРЕМІГ?» → дві великі
 *   картки; після тапу — перемикач «ДО 11 | ДО 21» + степер очок переможеного
 *   (0..target-1, дефолт 9/19) і ГОТОВО. Сет валідний за побудовою.
 * — 'sets': стара повна форма по сетах (validateSets, як і було) — за лінком
 *   «повний рахунок по сетах →», назад — «← швидкий ввід».
 */
export default function ScoreEntry({ a, b, onSubmit, onCancel }: {
  a: Player; b: Player;
  onSubmit: (sets: SetScore[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'quick' | 'sets'>('quick');
  const [pending, setPending] = useState(false);

  /* --- швидкий фініш --- */
  const [winner, setWinner] = useState<'a' | 'b' | null>(null);
  const [target, setTarget] = useState<QuickTarget>(11);
  const [loserPts, setLoserPts] = useState(() => quickDefaultLoser(11));

  const switchTarget = (t: QuickTarget) => {
    if (t === target) return;
    // дефолт слідує за ціллю (9 ↔ 19); кастомне значення лише клемпимо
    setLoserPts((p) => (p === quickDefaultLoser(target) ? quickDefaultLoser(t) : Math.min(p, QUICK_LOSER_MAX)));
    setTarget(t);
  };
  const bumpLoser = (d: 1 | -1) =>
    setLoserPts((p) => Math.min(QUICK_LOSER_MAX, Math.max(0, p + d)));

  const wp = winner === 'a' ? a : winner === 'b' ? b : null; // переможець
  const lp = winner === 'a' ? b : winner === 'b' ? a : null; // переможений
  const quick = winner === null ? null : quickSets(winner === 'a', target, loserPts);

  /* --- повний рахунок по сетах (стара форма, без змін у логіці) --- */
  const [sets, setSets] = useState<SetScore[]>([[...DEFAULT_SET]]);
  const err = validateSets(sets);
  const setsWinner = err === null ? (casualWinner(a.id, b.id, sets) === a.id ? a : b) : null;

  const bump = (i: number, side: 0 | 1, d: 1 | -1) =>
    setSets((prev) => prev.map((s, j) => {
      if (j !== i) return s;
      const next: SetScore = [...s];
      next[side] = Math.min(MAX, Math.max(0, next[side] + d));
      return next;
    }));

  const addSet = () => setSets((prev) => [...prev, [...DEFAULT_SET]]);
  const removeSet = (i: number) => setSets((prev) => prev.filter((_, j) => j !== i));

  async function submit(payload: SetScore[]) {
    // страховка перед живою БД: обидва режими проходять той самий валідатор
    if (pending || validateSets(payload) !== null) return;
    setPending(true);
    try { await onSubmit(payload); } finally { setPending(false); }
  }

  return (
    <div className="k-scrim" role="dialog" aria-modal="true" aria-label="Рахунок гри">
      <div className="k-sheet k-score">
        <div className="k-sheet-head">
          <h2>{mode === 'quick' ? 'ХТО ПЕРЕМІГ?' : 'РАХУНОК'}</h2>
          <span className="k-sheet-hint">{mode === 'quick' ? 'один сет' : 'по сетах'}</span>
          <button className="k-close" onClick={onCancel} aria-label="Назад без збереження">✕</button>
        </div>

        {mode === 'quick' ? (
          /* ---------- ШВИДКИЙ ФІНІШ ---------- */
          <div className="k-score-body k-quick">
            <div className="k-who">
              {([['a', a], ['b', b]] as const).map(([side, p]) => {
                const on = winner === side;
                return (
                  <button key={side} disabled={pending} aria-pressed={on}
                    className={'k-who-card' + (on ? ' on' : winner ? ' off' : '')}
                    onClick={() => setWinner(side)}>
                    {on && <PodiumCrown className="k-who-crown smash" />}
                    <HeroArt src={p.hero?.art} alt={p.nickname} color={p.hero?.color || 'var(--yellow)'}
                      initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={150} radius={22} />
                    <span className="k-who-nick"><NickFit nick={p.nickname || p.name} oneLine /></span>
                    <span className="k-who-tag">{on ? byGender(p, 'ПЕРЕМІГ', 'ПЕРЕМОГЛА', 'ПЕРЕМІГ(ЛА)') : byGender(p, 'тапни, якщо переміг', 'тапни, якщо перемогла', 'тапни, якщо переміг(ла)')}</span>
                  </button>
                );
              })}
              <span className="k-who-vs" aria-hidden="true">VS</span>
            </div>

            {wp && lp && (
              <div className="k-quick2">
                <div className="k-target">
                  <span className="k-quick-lbl">грали до</span>
                  <div className="k-target-pills" role="group" aria-label="Грали до скількох очок">
                    {QUICK_TARGETS.map((t) => (
                      <button key={t} className={'k-pill' + (target === t ? ' on' : '')} disabled={pending}
                        aria-pressed={target === t} onClick={() => switchTarget(t)}>ДО {t}</button>
                    ))}
                  </div>
                </div>
                <div className="k-loserpts">
                  <span className="k-quick-lbl">скільки набрав <b>{lp.nickname || lp.name}</b>?</span>
                  <div className="k-stepper quick">
                    <StepBtn label="−" onStep={() => bumpLoser(-1)} disabled={pending} />
                    <Pts v={loserPts} />
                    <StepBtn label="+" onStep={() => bumpLoser(1)} disabled={pending} className="plus" />
                  </div>
                </div>
              </div>
            )}

            <button className="k-mode-link" disabled={pending} onClick={() => setMode('sets')}>
              повний рахунок по сетах →
            </button>
          </div>
        ) : (
          /* ---------- ПОВНИЙ РАХУНОК ПО СЕТАХ ---------- */
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
                    <Pts v={s[0]} />
                    <StepBtn label="+" onStep={() => bump(i, 0, 1)} disabled={pending} className="plus" />
                  </div>
                  <span className="k-colon">:</span>
                  <div className="k-stepper">
                    <StepBtn label="−" onStep={() => bump(i, 1, -1)} disabled={pending} />
                    <Pts v={s[1]} />
                    <StepBtn label="+" onStep={() => bump(i, 1, 1)} disabled={pending} className="plus" />
                  </div>
                  <button className="k-set-x" disabled={pending} aria-label={`Прибрати сет ${i + 1}`} onClick={() => removeSet(i)}>✕</button>
                </div>
              ))}
              <button className="kbtn lg k-addset" disabled={pending} onClick={addSet}>+ СЕТ</button>
            </div>

            <button className="k-mode-link" disabled={pending} onClick={() => setMode('quick')}>
              ← швидкий ввід
            </button>
          </div>
        )}

        <footer className="k-sheet-foot">
          <div className="k-sel-line">
            {mode === 'quick'
              ? (wp
                ? <>{byGender(wp, 'Переміг', 'Перемогла', 'Переміг(ла)')}: <b>{wp.nickname || wp.name}</b><em className="k-quick-score">{quickWinnerPts(target, loserPts)}:{loserPts}</em></>
                : <i>тапни картку переможця</i>)
              : (setsWinner
                ? <>{byGender(setsWinner, 'Переміг', 'Перемогла', 'Переміг(ла)')}: <b>{setsWinner.nickname || setsWinner.name}</b></>
                : <i>{HINT[err as SetsError]}</i>)}
          </div>
          <button className="kbtn lg" onClick={onCancel} disabled={pending}>НАЗАД</button>
          {mode === 'quick' ? (
            <button className="kbtn xl pink k-confirm" disabled={pending || quick === null}
              onClick={() => { if (quick) void submit(quick); }}>
              {pending ? 'ЗБЕРІГАЮ…' : 'ГОТОВО'}
            </button>
          ) : (
            <button className="kbtn xl pink k-confirm" disabled={pending || err !== null}
              onClick={() => { void submit(sets); }}>
              {pending ? 'ЗБЕРІГАЮ…' : 'ЗАВЕРШИТИ'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

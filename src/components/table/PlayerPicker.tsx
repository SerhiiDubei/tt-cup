'use client';
import { useMemo, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';
import SelfieCapture from '@/components/SelfieCapture';
import { RatingChip } from '@/components/table/bits';
import { quickAddPlayer, setPlayerArt } from '@/lib/table/api';
import { stylizeSelfie } from '@/lib/api';
import { SUPERPOWER_LABEL } from '@/lib/avatar';
import { STYLES } from '@/config';

const STYLE_LABEL: Record<string, string> = { attacker: 'Атакер', defender: 'Захисник', allrounder: 'Універсал', spinner: 'Спінер' };

type QuickAdd = { step: 1 | 2 | 3; name: string; selfie: string | null; style: string; busy: boolean; err: string | null };

const QA_ERR: Record<string, string> = {
  nick_taken: 'Таке імʼя вже зайняте — підправ його трохи',
  name_required: 'Введи імʼя',
  name_too_long: 'Задовге імʼя — скороти',
};

/**
 * Повноекранний пікер гравців для кіоску. Тап = вибір; коли вибрано `count`,
 * зайвий тап заміняє найстарішого вибраного. quickAdd → картка «Я тут вперше +»:
 * імʼя → селфі (можна пропустити) → стиль → миттєво в пул (арт домальовується фоном).
 */
export default function PlayerPicker({
  players, allowedIds, count, preselected = [], title, confirmLabel, onConfirm, onClose, quickAdd,
}: {
  players: Player[];
  allowedIds?: string[];        // undefined = весь пул
  count: 1 | 2;
  preselected?: string[];
  title: string;
  confirmLabel: string;
  onConfirm: (ids: string[]) => void | Promise<void>;
  onClose: () => void;
  quickAdd?: boolean;
}) {
  const pool = useMemo(() => {
    if (!allowedIds) return players;
    const byId = new Map(players.map((p) => [p.id, p] as const));
    // порядок allowedIds (порядок черги) важливіший за порядок пулу
    return allowedIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  }, [players, allowedIds]);

  const [sel, setSel] = useState<string[]>(() =>
    preselected.filter((id) => pool.some((p) => p.id === id)).slice(0, count));
  const [pending, setPending] = useState(false);
  const [qa, setQa] = useState<QuickAdd | null>(null);

  function toggle(id: string) {
    setSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < count) return [...prev, id];
      return [...prev.slice(1), id]; // повний — заміняємо найстарішого
    });
  }

  async function confirm() {
    if (pending || sel.length !== count) return;
    setPending(true);
    try { await onConfirm(sel); } finally { setPending(false); }
  }

  /** «Готово» швидкої реєстрації: створюємо гравця МИТТЄВО, арт — фоном. */
  async function qaDone() {
    if (!qa || qa.busy || !qa.name.trim()) return;
    setQa({ ...qa, busy: true, err: null });
    try {
      const { id } = await quickAddPlayer(qa.name.trim(), qa.style);
      if (qa.selfie) {
        const { selfie, style } = qa;
        // fire-and-forget: помилки мовчки ігноруємо — лишиться кольорова заглушка
        void stylizeSelfie(selfie, style).then((r) => setPlayerArt(id, r.url)).catch(() => {});
      }
      await onConfirm([id]); // одразу вибираємо новачка й закриваємось
      // якщо батько проковтнув помилку і не закрив пікер — не лишаємось у «СТВОРЮЮ…»
      setQa((q) => (q ? { ...q, busy: false } : q));
    } catch (e) {
      const code = (e as Error).message;
      const backToName = code === 'nick_taken' || code === 'name_too_long' || code === 'name_required';
      setQa({ ...qa, busy: false, err: QA_ERR[code] ?? 'Не вийшло — спробуй ще раз', step: backToName ? 1 : qa.step });
    }
  }

  const selNames = sel.map((id) => pool.find((p) => p.id === id)?.nickname ?? '?');

  return (
    <div className="k-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="k-sheet">
        <div className="k-sheet-head">
          <h2>{title}</h2>
          {count === 2 && <span className="k-sheet-hint">обери двох</span>}
          <button className="k-close" onClick={onClose} aria-label="Закрити">✕</button>
        </div>

        {qa !== null ? (
          /* ---------- швидка реєстрація ---------- */
          <div className="k-qa">
            <span className="k-qa-step">крок {qa.step}/3 · {qa.step === 1 ? 'імʼя' : qa.step === 2 ? 'селфі' : 'стиль гри'}</span>

            {qa.step === 1 && (
              <>
                <input
                  className="k-qa-input" autoFocus maxLength={24} placeholder="Твоє імʼя або нік"
                  value={qa.name} enterKeyHint="next"
                  onChange={(e) => setQa({ ...qa, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && qa.name.trim()) setQa({ ...qa, step: 2, err: null }); }}
                />
                {qa.err && <p className="k-qa-err">{qa.err}</p>}
                <div className="k-qa-nav">
                  <button className="kbtn lg" onClick={() => setQa(null)}>← НАЗАД</button>
                  <button className="kbtn xl pink" disabled={!qa.name.trim()} onClick={() => setQa({ ...qa, step: 2, err: null })}>ДАЛІ →</button>
                </div>
              </>
            )}

            {qa.step === 2 && (
              <>
                <SelfieCapture onCaptured={(d) => setQa((q) => (q ? { ...q, selfie: d } : q))} onUnavailable={() => {}} />
                <div className="k-qa-nav">
                  <button className="kbtn lg" onClick={() => setQa({ ...qa, step: 1 })}>← НАЗАД</button>
                  {qa.selfie
                    ? <button className="kbtn xl pink" onClick={() => setQa({ ...qa, step: 3 })}>ДАЛІ →</button>
                    : <button className="kbtn lg yellow" onClick={() => setQa({ ...qa, selfie: null, step: 3 })}>ПРОПУСТИТИ</button>}
                </div>
                <p className="k-qa-hint">Фото піде лише на AI-стилізацію — картка-герой домалюється сама за ~хвилину.</p>
              </>
            )}

            {qa.step === 3 && (
              <>
                <div className="k-styles">
                  {STYLES.map((s) => (
                    <button key={s} className={'k-style-btn' + (qa.style === s ? ' on' : '')} disabled={qa.busy}
                      onClick={() => setQa({ ...qa, style: s })}>
                      <b>{STYLE_LABEL[s]}</b><span>{SUPERPOWER_LABEL[s]}</span>
                    </button>
                  ))}
                </div>
                {qa.err && <p className="k-qa-err">{qa.err}</p>}
                <div className="k-qa-nav">
                  <button className="kbtn lg" disabled={qa.busy} onClick={() => setQa({ ...qa, step: 2 })}>← НАЗАД</button>
                  <button className="kbtn xl pink" disabled={qa.busy} onClick={() => { void qaDone(); }}>{qa.busy ? 'СТВОРЮЮ…' : 'ГОТОВО'}</button>
                </div>
              </>
            )}
          </div>
        ) : (
        <>
        <div className="k-pick-grid">
          {quickAdd && (
            <button className="k-pick k-pick-add"
              onClick={() => setQa({ step: 1, name: '', selfie: null, style: 'attacker', busy: false, err: null })}>
              <span className="k-add-plus">+</span>
              <span className="k-pick-nick">Я тут вперше</span>
              <span className="k-pick-name">створи героя за 20 сек</span>
            </button>
          )}
          {pool.map((p) => {
            const idx = sel.indexOf(p.id);
            return (
              <button key={p.id} className={'k-pick' + (idx >= 0 ? ' on' : '')} onClick={() => toggle(p.id)}>
                {idx >= 0 && <span className="k-pick-slot">{count === 2 ? idx + 1 : '✓'}</span>}
                <div className="k-pick-art">
                  <HeroArt src={p.hero?.art} alt={p.nickname} color={p.hero?.color || 'var(--yellow)'}
                    initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={110} radius={18} />
                </div>
                <span className="k-pick-nick">{p.nickname || p.name}</span>
                <span className="k-pick-name">{p.name}</span>
                {p.rating != null && <RatingChip rating={p.rating} className="k-pick-rate" />}
              </button>
            );
          })}
          {pool.length === 0 && !quickAdd && (
            <div className="k-pick-empty">
              <i className="ttball" />
              <p>Нема кого показати — всі вже за столом або в черзі</p>
            </div>
          )}
        </div>

        <footer className="k-sheet-foot">
          <div className="k-sel-line">
            {count === 2
              ? (sel.length === 2 ? <><b>{selNames[0]}</b><span className="vs">проти</span><b>{selNames[1]}</b></>
                : sel.length === 1 ? <><b>{selNames[0]}</b><span className="vs">проти</span><i>тапни другого…</i></>
                : <i>тапни двох гравців…</i>)
              : (sel.length === 1 ? <b>{selNames[0]}</b> : <i>тапни себе у списку…</i>)}
          </div>
          <button className="kbtn xl pink k-confirm" disabled={pending || sel.length !== count} onClick={() => { void confirm(); }}>
            {pending ? 'СЕКУНДУ…' : confirmLabel}
          </button>
        </footer>
        </>
        )}
      </div>
    </div>
  );
}

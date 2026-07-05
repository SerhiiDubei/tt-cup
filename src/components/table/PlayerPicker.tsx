'use client';
import { useMemo, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';

/**
 * Повноекранний пікер гравців для кіоску. Тап = вибір; коли вибрано `count`,
 * зайвий тап заміняє найстарішого вибраного. quickAdd → картка «Я тут вперше +»
 * (потік швидкої реєстрації — див. step 4).
 */
export default function PlayerPicker({
  players, allowedIds, count, preselected = [], title, confirmLabel, onConfirm, onClose,
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

  const selNames = sel.map((id) => pool.find((p) => p.id === id)?.nickname ?? '?');

  return (
    <div className="k-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="k-sheet">
        <header className="k-sheet-head">
          <h2>{title}</h2>
          {count === 2 && <span className="k-sheet-hint">обери двох</span>}
          <button className="k-close" onClick={onClose} aria-label="Закрити">✕</button>
        </header>

        <div className="k-pick-grid">
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
              </button>
            );
          })}
          {pool.length === 0 && (
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
      </div>
    </div>
  );
}

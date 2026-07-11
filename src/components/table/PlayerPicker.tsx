'use client';
import { useMemo, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';
import SelfieCapture from '@/components/SelfieCapture';
import { NickFit, RatingChip } from '@/components/table/bits';
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
 * зайвий тап заміняє найстарішого вибраного. quickAdd (діє лише коли пул не
 * обмежений чергою) → велика кнопка «Я ТУТ НОВИЙ» у шапці:
 * імʼя → селфі (можна пропустити) → стиль → миттєво в пул (арт домальовується фоном).
 * Пул >6 гравців → пошук по ніку/імені, як каса самообслуговування.
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
  // локальні «тіні» щойно створених гравців — картка зʼявляється миттєво,
  // ще до того, як полінг батька підтягне свіжий пул
  const [extras, setExtras] = useState<Player[]>([]);

  const pool = useMemo(() => {
    if (!allowedIds) {
      const seen = new Set(players.map((p) => p.id));
      return [...players, ...extras.filter((e) => !seen.has(e.id))];
    }
    const byId = new Map(players.map((p) => [p.id, p] as const));
    // порядок allowedIds (порядок черги) важливіший за порядок пулу
    return allowedIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  }, [players, allowedIds, extras]);

  // швидка реєстрація доступна тільки коли пул НЕ обмежений чергою
  const canQuickAdd = !!quickAdd && !allowedIds;
  const showSearch = pool.length > 6;

  const [sel, setSel] = useState<string[]>(() =>
    preselected.filter((id) => pool.some((p) => p.id === id)).slice(0, count));
  const [pending, setPending] = useState(false);
  const [qa, setQa] = useState<QuickAdd | null>(null);
  const [q, setQ] = useState('');

  // живий фільтр: нік АБО імʼя, без регістру (українські літери теж)
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('uk');
    if (!needle) return pool;
    return pool.filter((p) =>
      (p.nickname ?? '').toLocaleLowerCase('uk').includes(needle) ||
      (p.name ?? '').toLocaleLowerCase('uk').includes(needle));
  }, [pool, q]);

  const openQa = (name = '') =>
    setQa({ step: 1, name, selfie: null, style: 'attacker', busy: false, err: null });

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
      const nick = qa.name.trim();
      const { id } = await quickAddPlayer(nick, qa.style);
      if (qa.selfie) {
        const { selfie, style } = qa;
        // fire-and-forget: помилки мовчки ігноруємо — лишиться кольорова заглушка
        void stylizeSelfie(selfie, style).then((r) => setPlayerArt(id, r.url)).catch(() => {});
      }
      if (count === 1) {
        await onConfirm([id]); // одразу вибираємо новачка й закриваємось
        // якщо батько проковтнув помилку і не закрив пікер — не лишаємось у «СТВОРЮЮ…»
        setQa((prev) => (prev ? { ...prev, busy: false } : prev));
      } else {
        // пікер на двох: новачок одразу в сітці й у виборі — лишилось тапнути суперника
        setExtras((prev) => [...prev, {
          id, name: nick, nickname: nick, seed: 0,
          hero: { color: 'var(--yellow)', shape: 'circle', emblem: '★', style: qa.style },
        }]);
        setSel((prev) => (prev.includes(id) ? prev
          : prev.length < count ? [...prev, id] : [...prev.slice(1), id]));
        setQ('');
        setQa(null);
      }
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
        {(showSearch || canQuickAdd) && (
          <div className="k-pick-tools">
            {showSearch && (
              <div className="k-search">
                <svg className="k-search-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="10.5" cy="10.5" r="6.3" stroke="currentColor" strokeWidth="3" />
                  <path d="m15.6 15.6 5.2 5.2" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
                </svg>
                {/* без autoFocus: клавіатура планшета не має вискакувати сама */}
                <input className="k-search-input" type="text" enterKeyHint="search" autoComplete="off"
                  placeholder="Знайди себе: нік або імʼя" aria-label="Пошук гравця"
                  value={q} onChange={(e) => setQ(e.target.value)} />
                {q !== '' && (
                  <button className="k-search-x" onClick={() => setQ('')} aria-label="Очистити пошук">✕</button>
                )}
              </div>
            )}
            {canQuickAdd && (
              <button className="k-newbie" onClick={() => openQa()}>
                <i aria-hidden="true">+</i>Я ТУТ НОВИЙ
              </button>
            )}
          </div>
        )}
        <div className="k-pick-grid">
          {shown.map((p) => {
            const idx = sel.indexOf(p.id);
            return (
              <button key={p.id} className={'k-pick' + (idx >= 0 ? ' on' : '')} onClick={() => toggle(p.id)}>
                {idx >= 0 && <span className="k-pick-slot">{count === 2 ? idx + 1 : '✓'}</span>}
                <div className="k-pick-art">
                  <HeroArt src={p.hero?.art} alt={p.nickname} color={p.hero?.color || 'var(--yellow)'}
                    initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={150} radius={20} />
                </div>
                <span className="k-pick-nick"><NickFit nick={p.nickname || p.name} oneLine /></span>
                <span className="k-pick-name k-oneline">{p.name}</span>
                {p.rating != null && <RatingChip rating={p.rating} className="k-pick-rate" />}
              </button>
            );
          })}
          {pool.length === 0 && (
            <div className="k-pick-empty">
              <i className="ttball" />
              <p>{canQuickAdd
                ? 'Поки нікого — будь тут перш(-а/-ий)!'
                : 'Нема кого показати — всі вже за столом або в черзі'}</p>
              {canQuickAdd && (
                <button className="kbtn lg yellow" onClick={() => openQa()}>Я ТУТ НОВИЙ</button>
              )}
            </div>
          )}
          {pool.length > 0 && shown.length === 0 && (
            <div className="k-pick-none">
              <b>Нікого не знайшли</b>
              <p>«{q.trim()}» нема серед гравців{canQuickAdd ? ' — створи нового героя' : ''}</p>
              {canQuickAdd && (
                <button className="kbtn lg pink" onClick={() => openQa(q.trim())}>СТВОРИТИ НОВОГО</button>
              )}
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

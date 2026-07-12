'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';
import SelfieCapture from '@/components/SelfieCapture';
import { NickFit, RatingChip } from '@/components/table/bits';
import { quickAddPlayer, setPlayerArt } from '@/lib/table/api';
import { stylizeSelfie } from '@/lib/api';
import { markArtPending, clearArtPending, isArtPending } from '@/lib/table/artPending';
import { SUPERPOWER_LABEL } from '@/lib/avatar';
import { STYLES } from '@/config';

const STYLE_LABEL: Record<string, string> = { attacker: 'Атакер', defender: 'Захисник', allrounder: 'Універсал', spinner: 'Спінер' };

type QuickAdd = { step: 1 | 2 | 3; name: string; selfie: string | null; style: string; gender: 'male' | 'female' | null; busy: boolean; err: string | null };

const QA_ERR: Record<string, string> = {
  nick_taken: 'Таке імʼя вже зайняте — підправ його трохи',
  name_required: 'Введи імʼя',
  name_too_long: 'Задовге імʼя — скороти',
};

/** Крок stagger-появи карток і стеля сумарної затримки (спека: ~20мс, ≤400мс). */
const STAGGER_STEP_MS = 20;
const STAGGER_CAP_MS = 400;

/**
 * Чистий перехід вибору: тап по вибраному знімає, по новому — додає;
 * коли повний — заміняє найстаршого. `out` — хто і з якого слота вилетів
 * (щоб евікшн було ВИДНО, а не «Артем зник»).
 */
function applyPick(prev: string[], id: string, count: number): {
  next: string[]; out: { id: string; slot: number } | null; picked: boolean;
} {
  const at = prev.indexOf(id);
  if (at >= 0) return { next: prev.filter((x) => x !== id), out: { id, slot: at }, picked: false };
  if (prev.length < count) return { next: [...prev, id], out: null, picked: true };
  return { next: [...prev.slice(1), id], out: { id: prev[0], slot: 0 }, picked: true };
}

/** Обличчя чипа слота: міні-арт + нік (одним рядком). */
function SlotFace({ p }: { p: Player }) {
  return (
    <>
      <HeroArt src={p.hero?.art} alt={p.nickname} color={p.hero?.color || 'var(--yellow)'}
        initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={38} radius={10}
        pending={!p.hero?.art && isArtPending(p.id)} />
      <span className="k-slot-nick"><NickFit nick={p.nickname || p.name} oneLine /></span>
    </>
  );
}

/**
 * Повноекранний пікер гравців для кіоску. Тап = вибір; коли вибрано `count`,
 * зайвий тап заміняє найстарішого вибраного. Вибрані живуть у ПОСТІЙНИХ
 * СЛОТАХ під шапкою — видимі при будь-якому пошуку/скролі, тап по слоту знімає.
 * quickAdd (діє лише коли пул не обмежений чергою) → велика кнопка
 * «Я ТУТ НОВИЙ» у шапці: імʼя → селфі (можна пропустити) → стиль → миттєво
 * в пул (арт домальовується фоном). Пул >6 гравців → пошук по ніку/імені.
 */
export default function PlayerPicker({
  players, allowedIds, count, minCount, preselected = [], title, confirmLabel, onConfirm, onClose, quickAdd,
}: {
  players: Player[];
  allowedIds?: string[];        // undefined = весь пул
  count: 1 | 2;
  /** Мінімум вибраних для підтвердження (дефолт = count). 1 при count=2 — «можна вдвох». */
  minCount?: number;
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
      // авто-сорт «кому легше знайтись»: хто грав нещодавно — зверху, далі за ніком
      const sorted = [...players].sort((a, b) =>
        (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? '') ||
        (a.nickname || a.name).localeCompare(b.nickname || b.name, 'uk'));
      return [...sorted, ...extras.filter((e) => !seen.has(e.id))];
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

  /* --- анімації: виліт зі слота, сплеск на виборі, stagger сітки --- */
  const [leaving, setLeaving] = useState<{ key: number; p: Player; slot: number }[]>([]);
  const leaveKey = useRef(0);
  const [burst, setBurst] = useState<{ id: string; key: number } | null>(null);
  const [stagger, setStagger] = useState(true);

  // stagger — разовий, тільки на відкриття шіта: далі пошук/полінг не миготять
  useEffect(() => {
    const t = setTimeout(() => setStagger(false), STAGGER_CAP_MS + 450);
    return () => clearTimeout(t);
  }, []);
  // сплеск короткий; прибираємо вузли після відльоту зірочок
  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 700);
    return () => clearTimeout(t);
  }, [burst]);

  // живий фільтр: нік АБО імʼя, без регістру (українські літери теж)
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('uk');
    if (!needle) return pool;
    return pool.filter((p) =>
      (p.nickname ?? '').toLocaleLowerCase('uk').includes(needle) ||
      (p.name ?? '').toLocaleLowerCase('uk').includes(needle));
  }, [pool, q]);

  const openQa = (name = '') =>
    setQa({ step: 1, name, selfie: null, style: 'attacker', gender: null, busy: false, err: null });

  /** Спільний вхід для тапів по картках, слотах і квик-адду двомісного пікера. */
  function pick(id: string) {
    const { next, out, picked } = applyPick(sel, id, count);
    if (out) {
      const p = pool.find((x) => x.id === out.id);
      if (p) setLeaving((l) => [...l.slice(-3), { key: ++leaveKey.current, p, slot: out.slot }]);
    }
    if (picked) setBurst((b) => ({ id, key: (b?.key ?? 0) + 1 }));
    setSel(next);
  }

  async function confirm() {
    const min = minCount ?? count;
    if (pending || sel.length < min || sel.length > count) return;
    setPending(true);
    try { await onConfirm(sel); } finally { setPending(false); }
  }

  /** «Готово» швидкої реєстрації: створюємо гравця МИТТЄВО, арт — фоном. */
  async function qaDone() {
    if (!qa || qa.busy || !qa.name.trim()) return;
    setQa({ ...qa, busy: true, err: null });
    try {
      const nick = qa.name.trim();
      const { id } = await quickAddPlayer(nick, qa.style, qa.gender ?? undefined);
      if (qa.selfie) {
        const { selfie, style } = qa;
        markArtPending(id); // картки/ряди новачка показують міні-лоадер, поки арт вариться
        // fire-and-forget: помилки мовчки ігноруємо — лишиться кольорова заглушка
        void stylizeSelfie(selfie, style).then((r) => setPlayerArt(id, r.url))
          .catch(() => clearArtPending(id));
      }
      if (count === 1) {
        await onConfirm([id]); // одразу вибираємо новачка й закриваємось
        // якщо батько проковтнув помилку і не закрив пікер — не лишаємось у «СТВОРЮЮ…»
        setQa((prev) => (prev ? { ...prev, busy: false } : prev));
      } else {
        // пікер на двох: новачок одразу в сітці й у виборі — лишилось тапнути суперника
        setExtras((prev) => [...prev, {
          id, name: nick, nickname: nick, seed: 0,
          hero: { color: 'var(--yellow)', shape: 'circle', emblem: '★', style: qa.style, ...(qa.gender ? { gender: qa.gender } : {}) },
        }]);
        pick(id);
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

  /** Один постійний слот: вибраний завжди тут, хай що показує пошук/скрол. */
  const renderSlot = (i: number) => {
    const id = sel[i];
    const p = id ? pool.find((x) => x.id === id) ?? {
      id, name: '?', nickname: '· · ·', seed: 0,
      hero: { color: 'var(--yellow)', shape: 'circle', emblem: '★', style: 'allrounder' },
    } : undefined;
    return (
      <div className={'k-slot' + (p ? ' filled' : '')} key={i}>
        {leaving.filter((l) => l.slot === i).map((l) => (
          <span className="k-slot-chip out" key={l.key} aria-hidden="true"
            onAnimationEnd={() => setLeaving((cur) => cur.filter((x) => x.key !== l.key))}>
            <SlotFace p={l.p} />
          </span>
        ))}
        {p ? (
          <button className="k-slot-chip in" key={p.id} disabled={pending}
            aria-label={`Зняти ${p.nickname || p.name} з вибору`} onClick={() => pick(p.id)}>
            <SlotFace p={p} />
            <i className="x" aria-hidden="true">✕</i>
          </button>
        ) : (
          <span className="k-slot-empty">
            <i aria-hidden="true">+</i>
            {count === 2
              ? (i === 1 && (minCount ?? count) === 1 ? 'можна вдвох (необовʼязково)' : `гравець ${i + 1}…`)
              : 'тапни себе в списку…'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="k-scrim" role="dialog" aria-modal="true" aria-label={title}>
      <div className="k-sheet">
        {/* компактна шапка: заголовок + пошук + «Я ТУТ НОВИЙ» в одному рядку —
            бари не з'їдають місце під картки */}
        <div className="k-sheet-head">
          <h2>{title}</h2>
          {qa === null && count === 2 && (
            <span className="k-sheet-hint">{(minCount ?? count) === 1 ? 'один або двоє' : 'обери двох'}</span>
          )}
          {qa === null && showSearch && (
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
          {qa === null && canQuickAdd && (
            <button className="k-newbie" onClick={() => openQa()}>
              <i aria-hidden="true">+</i>Я ТУТ НОВИЙ
            </button>
          )}
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
                <div className="k-gender" role="group" aria-label="Стать (необовʼязково)">
                  {([['male', 'ВІН'], ['female', 'ВОНА'], [null, '—']] as const).map(([g, label]) => (
                    <button key={label} className={'k-pill' + (qa.gender === g ? ' on' : '')} disabled={qa.busy}
                      aria-pressed={qa.gender === g} onClick={() => setQa({ ...qa, gender: g })}>{label}</button>
                  ))}
                </div>
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
        {/* ПОСТІЙНІ СЛОТИ ВИБОРУ: вибрані видно завжди — пошук/скрол їх не ховає,
            евікшн «найстаршого» вилітає анімовано, а не зникає мовчки */}
        <div className="k-slotbar" data-count={count}>
          {renderSlot(0)}
          {count === 2 && <span className="k-slot-vs" aria-hidden="true">проти</span>}
          {count === 2 && renderSlot(1)}
        </div>

        <div className={'k-pick-grid' + (stagger ? ' stagger' : '')}>
          {shown.map((p, i) => {
            const idx = sel.indexOf(p.id);
            return (
              <button key={p.id} className={'k-pick' + (idx >= 0 ? ' on' : '')}
                style={stagger ? { ['--d' as string]: `${Math.min(i * STAGGER_STEP_MS, STAGGER_CAP_MS)}ms` } : undefined}
                onClick={() => pick(p.id)}>
                {idx >= 0 && <span className="k-pick-slot">{count === 2 ? idx + 1 : '✓'}</span>}
                {burst?.id === p.id && (
                  <span className="k-burst" key={burst.key} aria-hidden="true">
                    <i className="star" style={{ ['--bx' as string]: '-46px', ['--by' as string]: '-38px', background: 'var(--yellow)' }} />
                    <i className="dot" style={{ ['--bx' as string]: '44px', ['--by' as string]: '-30px', background: 'var(--pink)' }} />
                    <i className="star" style={{ ['--bx' as string]: '52px', ['--by' as string]: '20px', background: 'var(--cyan)' }} />
                    <i className="dot" style={{ ['--bx' as string]: '-38px', ['--by' as string]: '34px', background: 'var(--lime)' }} />
                    <i className="star" style={{ ['--bx' as string]: '6px', ['--by' as string]: '-54px', background: 'var(--coral)' }} />
                    <i className="dot" style={{ ['--bx' as string]: '-8px', ['--by' as string]: '48px', background: 'var(--purple)' }} />
                  </span>
                )}
                <div className="k-pick-art">
                  <HeroArt src={p.hero?.art} alt={p.nickname} color={p.hero?.color || 'var(--yellow)'}
                    initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={150} radius={20}
                    pending={!p.hero?.art && isArtPending(p.id)} />
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
              ? (sel.length === 2 ? <><b>{selNames[0]}</b><span className="vs">{(minCount ?? count) === 1 ? '+' : 'проти'}</span><b>{selNames[1]}</b></>
                : sel.length === 1 ? <><b>{selNames[0]}</b>{(minCount ?? count) === 1 ? <i> — можна додати другого…</i> : <><span className="vs">проти</span><i>тапни другого…</i></>}</>
                : <i>тапни двох гравців…</i>)
              : (sel.length === 1 ? <b>{selNames[0]}</b> : <i>тапни себе у списку…</i>)}
          </div>
          <button className="kbtn lg pink k-confirm" disabled={pending || sel.length < (minCount ?? count)} onClick={() => { void confirm(); }}>
            {pending ? 'СЕКУНДУ…' : confirmLabel}
          </button>
        </footer>
        </>
        )}
      </div>
    </div>
  );
}

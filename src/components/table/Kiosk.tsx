'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TableState } from '@/lib/table/state';
import type { Player, SetScore } from '@/lib/tournament/types';
import { getTableState, startGame, finishGame, joinQueue, cancelGame, leaveQueue } from '@/lib/table/api';
import { winProb, leagueOf } from '@/lib/table/elo';
import { isArtPending } from '@/lib/table/artPending';
import HeroArt from '@/components/HeroArt';
import PlayerPicker from '@/components/table/PlayerPicker';
import ScoreEntry from '@/components/table/ScoreEntry';
import WhoNext from '@/components/table/WhoNext';
import Leaderboard from '@/components/table/Leaderboard';
import Ceremony, { type CeremonyData } from '@/components/table/Ceremony';
import QueueIdle from '@/components/table/QueueIdle';
import Showcase from '@/components/table/Showcase';
import { useArmed, NickFit, RatingChip, byGender } from '@/components/table/bits';
import { BRAND } from '@/config';

type Overlay =
  | { k: 'none' }
  | { k: 'pick-start' }
  | { k: 'pick-queue' }
  | { k: 'score'; gameId: string; aId: string; bId: string }
  | { k: 'next'; winnerId: string; loserId: string; sets: SetScore[] };

/* ---------- дрібні хелпери ---------- */

const POLL_MS = 3000;
const EASE = 'cubic-bezier(.22,1,.36,1)';
/** Заставка-вітрина: 2 хв без тапів (у демо ?demo=idle — 3 с, лишається в коді). */
const IDLE_MS = 120_000;
const IDLE_DEMO_MS = 3_000;

const ERR_TEXT: Record<string, string> = {
  timeout: 'Немає звʼязку — спробуй ще раз',
  state_failed: 'Немає звʼязку — спробуй ще раз',
  nick_taken: 'Такий нік уже є — зміни імʼя',
};
// короткі snake_case-коди — конфлікти стану (409); текст із пробілами —
// серверна помилка (500, напр. postgres) — чесно кажемо, що не збереглось
const errText = (code: string) => ERR_TEXT[code] ?? (code.includes(' ')
  ? 'Помилка збереження — спробуй ще раз'
  : 'Стан змінився — синхронізуюсь');

function clockFrom(startedAt: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const POS_COLORS = ['var(--lime)', 'var(--cyan)', 'var(--yellow)', 'var(--pink)', 'var(--purple)', 'var(--coral)', 'var(--blue)'];

const FALLBACK_PLAYER = (id: string): Player => ({
  id, name: '?', nickname: '· · ·', seed: 0,
  hero: { color: 'var(--yellow)', shape: 'circle', emblem: '★', style: 'allrounder' },
});

/* мок «стіл вільний» (?demo=free): статичний стан без жодного виклику API —
   локальна розробка анімацій/верстки, коли Supabase не налаштований */
function mockFreeState(): TableState {
  const mk = (i: string, nickname: string, color: string, rating: number) => ({
    id: `mock-${i}`, name: 'Демо', nickname, seed: 0, rating,
    hero: { color, shape: 'circle', emblem: '★', style: 'allrounder' },
  } as Player & { rating: number });
  const players = [
    mk('a', 'TOPSPIN_OLEG', 'var(--pink)', 1082),
    mk('b', 'LOOP_KING', 'var(--cyan)', 1041),
    mk('c', 'SLICE_ART', 'var(--yellow)', 1017),
    mk('d', 'НАКАТ', 'var(--purple)', 996),
  ];
  return {
    game: null, queue: [], players,
    leaderboard: players.map((p, i) => ({
      id: p.id, rating: p.rating, wins: 9 - i * 2, losses: 2 + i,
      streak: i === 0 ? 3 : 0, move: null, form: 'WWLWW', titles: [],
    })),
    weekly: [], recent: [], lastWinner: 'mock-a',
  };
}

/* мок «гра йде» (?demo=game): активна гра + черга з двох — анімації живого
   табло без Supabase */
function mockGameState(): TableState {
  const s = mockFreeState();
  return {
    ...s,
    game: {
      id: 'mock-game', a: 'mock-a', b: 'mock-b', sets: [], winner: null,
      status: 'active', started_at: new Date(Date.now() - 27_000).toISOString(), ended_at: null,
    },
    queue: [
      { id: 'mock-q1', player_id: 'mock-c', joined_at: new Date().toISOString() },
      { id: 'mock-q2', player_id: 'mock-d', joined_at: new Date().toISOString() },
    ],
  };
}

/* ---------- декоративний squiggle (крафтовий SVG) ---------- */
function Squiggle({ color = 'var(--pink)' }: { color?: string }) {
  return (
    <svg className="squig" viewBox="0 0 280 28" fill="none" aria-hidden="true">
      <path d="M4 20 Q 22 4, 40 16 T 76 16 T 112 16 T 148 16 T 184 16 T 220 16 T 256 16 L 276 10"
        stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Табло шансів по Elo: тонка Memphis-смужка між герой-картками, заповнення
 * ділиться за winProb; оновлюється полінгом разом із рейтингами.
 */
function OddsBar({ ra, rb }: { ra: number; rb: number }) {
  const pct = Math.round(winProb(ra, rb) * 100);
  return (
    <div className="k-odds" role="img" aria-label={`шанси на перемогу: ${pct}% проти ${100 - pct}%`}>
      <b className="pa">{pct}%</b>
      <div className="k-odds-bar"><i style={{ width: `${pct}%` }} /></div>
      <b className="pb">{100 - pct}%</b>
    </div>
  );
}

function CupIcon() {
  return (
    <svg className="cup" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="var(--yellow)" stroke="var(--line)" strokeWidth="2" />
      <path d="M7 5H4.5a3 3 0 0 0 3 4M17 5h2.5a3 3 0 0 1-3 4" stroke="var(--line)" strokeWidth="2" />
      <path d="M12 14v3m-4 3h8l-1-3h-6l-1 3Z" fill="var(--yellow)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- ряд черги ---------- */
function QueueRow({ p, i, busy, onLeave }: { p: Player; i: number; busy: boolean; onLeave: (id: string) => void }) {
  const [armed, fire, armRef] = useArmed();
  return (
    <div className="k-qrow" data-qid={p.id}>
      <span className="k-qpos" style={{ background: POS_COLORS[i % POS_COLORS.length] }}>{i + 1}</span>
      <span className="k-qname">
        {i === 0 && <span className="k-qnext">наступний</span>}
        <NickFit nick={p.nickname || p.name} oneLine />
      </span>
      <button ref={armRef} className={'k-qx' + (armed ? ' armed' : '')} disabled={busy}
        aria-label={`Прибрати ${p.nickname} з черги`}
        onClick={() => fire(() => onLeave(p.id))}>
        {armed ? 'Точно?' : '✕'}
      </button>
    </div>
  );
}

/**
 * Панель черги з FLIP-анімацією: позиції міряємо ДО фарби (useLayoutEffect,
 * координати відносно контенту списку — скрол не дає фальшивих зсувів) і
 * програємо через WAAPI (анімації самозавершні, нічого чистити руками):
 * нова картка в'їжджає з підскоком, перенумерація їде плавно. Перший рендер
 * панелі — без в'їзду (щоб перемикання гра/вільно не «сипало» всю чергу).
 */
function QueuePanel({ queue, busy, onLeave }: { queue: Player[]; busy: boolean; onLeave: (id: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevTops = useRef<Map<string, number> | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const tops = new Map<string, number>();
    if (list) {
      const base = list.getBoundingClientRect().top - list.scrollTop;
      list.querySelectorAll<HTMLElement>('[data-qid]').forEach((el) => {
        tops.set(el.dataset.qid as string, el.getBoundingClientRect().top - base);
      });
    }
    const prev = prevTops.current;
    prevTops.current = tops;
    if (!list || !prev) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    list.querySelectorAll<HTMLElement>('[data-qid]').forEach((el) => {
      if (typeof el.animate !== 'function') return;
      const id = el.dataset.qid as string;
      const from = prev.get(id);
      const to = tops.get(id) as number;
      if (from == null) {
        el.animate([
          { transform: 'translateY(30px) scale(.92)', opacity: 0 },
          { transform: 'translateY(-7px) scale(1.03)', opacity: 1, offset: .65 },
          { transform: 'none', opacity: 1 },
        ], { duration: 460, easing: EASE });
      } else if (Math.abs(from - to) > 1) {
        el.animate(
          [{ transform: `translateY(${from - to}px)` }, { transform: 'none' }],
          { duration: 320, easing: EASE },
        );
      }
    });
  });

  return (
    <aside className="k-queue">
      <div className="k-queue-head">
        <h2>ЧЕРГА</h2>
        <span className="k-queue-count">{queue.length}</span>
      </div>
      {queue.length === 0 ? (
        <div className="k-queue-empty">
          <QueueIdle />
          <p>Черга порожня — стіл чекає на тебе</p>
        </div>
      ) : (
        <div className="k-queue-list" ref={listRef}>
          {queue.map((p, i) => <QueueRow key={p.id} p={p} i={i} busy={busy} onLeave={onLeave} />)}
        </div>
      )}
    </aside>
  );
}

/* ---------- кнопка «Скасувати гру» (подвійний тап) ---------- */
function CancelGameButton({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  const [armed, fire, armRef] = useArmed();
  return (
    <button ref={armRef} className={'kbtn ghost-danger' + (armed ? ' armed' : '')} disabled={busy}
      onClick={() => fire(onCancel)}>
      {armed ? 'Точно скасувати? Тапни ще раз' : 'Скасувати гру'}
    </button>
  );
}

/* ============================================================
   KIOSK — корінь
   ============================================================ */
export default function Kiosk() {
  const [state, setState] = useState<TableState | null>(null);
  const [fails, setFails] = useState(0);
  const [tab, setTab] = useState<'table' | 'board'>('table');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const stateRef = useRef<TableState | null>(null);
  const finishFailsRef = useRef(0); // поспіль невдалі збереження рахунку

  /* демо-режими (див. блок нижче) читаємо до полінгу: ?demo=free живе
     повністю на моку і не має чіпати API взагалі */
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => {
    setDemo(new URLSearchParams(window.location.search).get('demo'));
  }, []);

  /* --- полінг стану --- */
  const refetch = useCallback(async () => {
    try {
      const s = await getTableState();
      stateRef.current = s;
      setState(s);
      setFails(0);
    } catch {
      setFails((f) => f + 1);
    }
  }, []);

  useEffect(() => {
    // мок замість живого стану ('idle' — теж вільний стіл, щоб заставка
    // могла відкритись без Supabase)
    if (demo === 'free' || demo === 'game' || demo === 'idle') {
      const s = demo === 'game' ? mockGameState() : mockFreeState();
      stateRef.current = s;
      setState(s);
      setFails(0);
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => { void refetch(); }, POLL_MS); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.hidden) stop();
      else { void refetch(); start(); }
    };
    void refetch(); start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [refetch, demo]);

  /* --- wake lock, щоб планшет не засинав --- */
  useEffect(() => {
    type WL = { release(): Promise<void> };
    let lock: WL | null = null;
    let dead = false;
    const grab = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WL> } }).wakeLock;
        const l = await wl?.request('screen');
        if (dead) void l?.release().catch(() => {});
        else if (l) lock = l;
      } catch { /* тихо: не критично */ }
    };
    const onVis = () => { if (!document.hidden) void grab(); };
    void grab();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => {});
    };
  }, []);

  /* --- секундомір гри --- */
  const gameId = state?.game?.id;
  useEffect(() => {
    if (!gameId) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [gameId]);

  /* --- тост автозникає --- */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /* --- один запуск дії за раз --- */
  const run = useCallback(async (fn: () => Promise<unknown>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true);
    try {
      await fn();
      await refetch();
      return true;
    } catch (e) {
      setToast(errText((e as Error).message));
      void refetch();
      return false;
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }, [refetch]);

  /* --- похідні --- */
  const playersMap = useMemo(
    () => new Map((state?.players ?? []).map((p) => [p.id, p] as const)),
    [state?.players],
  );
  const P = useCallback((id: string) => playersMap.get(id) ?? FALLBACK_PLAYER(id), [playersMap]);
  const queuePlayers = useMemo(
    () => (state?.queue ?? []).map((q) => P(q.player_id)),
    [state?.queue, P],
  );

  const offline = fails >= 2;
  const game = state?.game ?? null;
  const [overlay, setOverlay] = useState<Overlay>({ k: 'none' });
  const closeOverlay = useCallback(() => setOverlay({ k: 'none' }), []);

  /* --- церемонія після finish (+ «Хто далі?», що чекає за нею) --- */
  const [ceremony, setCeremony] = useState<
    (CeremonyData & { next: { winnerId: string; loserId: string; sets: SetScore[] } | null }) | null
  >(null);

  /* демо-гілки для візуальної перевірки БЕЗ запису в живу БД (навмисно
     лишаються в коді — без URL-параметра їх не увімкнути):
     ?demo=ceremony — церемонія; ?demo=finish — швидкий фініш із моками і
     console.log замість finishGame; ?demo=idle — заставка за 3с;
     ?demo=queue — локальний мок-список черги для анімацій в'їзду/FLIP;
     ?demo=free / ?demo=game — мок «стіл вільний» / «гра йде» без API
     (сам demo-стан оголошено вище) */
  const [demoCeremony, setDemoCeremony] = useState(false);
  const [demoFinish, setDemoFinish] = useState(false);
  useEffect(() => {
    if (demo === 'ceremony') setDemoCeremony(true);
    if (demo === 'finish') setDemoFinish(true);
  }, [demo]);

  /* мок-черга (?demo=queue): що ~2.6с додається картка, далі — ротація порядку;
     все локально, жодного виклику API */
  const demoQueue = demo === 'queue';
  const [mockQueue, setMockQueue] = useState<Player[]>([]);
  useEffect(() => {
    if (!demoQueue) return;
    const names = ['TOP_SPIN', 'НАКАТ', 'SMASH_BRO', 'LOOPER', 'CHOP_CHOP', 'БЛОКС'];
    const colors = ['var(--cyan)', 'var(--pink)', 'var(--yellow)', 'var(--lime)', 'var(--purple)', 'var(--coral)'];
    const t = setInterval(() => {
      // апдейтер чистий (id — перший вільний індекс), тож StrictMode-безпечний
      setMockQueue((prev) => {
        if (prev.length < names.length) {
          let i = 0;
          while (prev.some((p) => p.id === `mock-${i}`)) i += 1;
          return [...prev, {
            id: `mock-${i}`, name: 'Демо', nickname: names[i % names.length], seed: 0,
            hero: { color: colors[i % colors.length], shape: 'circle', emblem: '★', style: 'attacker' },
          }];
        }
        const next = [...prev];
        next.push(next.shift() as Player); // ротація → видно FLIP-перенумерацію
        return next;
      });
    }, 2600);
    return () => clearInterval(t);
  }, [demoQueue]);

  const onLeave = useCallback((id: string) => {
    if (id.startsWith('mock-')) { // демо-ряд прибираємо локально, БД не чіпаємо
      setMockQueue((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    void run(() => leaveQueue(id));
  }, [run]);

  /* --- пули для пікерів --- */
  const queueIds = useMemo(() => (state?.queue ?? []).map((q) => q.player_id), [state?.queue]);
  // старт: якщо черга непорожня — тільки черга (+ переможець минулої гри, як дозволяє сервер)
  const startAllowed = useMemo(() => {
    if (queueIds.length === 0) return undefined;
    const ids = [...queueIds];
    if (state?.lastWinner && !ids.includes(state.lastWinner) && playersMap.has(state.lastWinner)) ids.push(state.lastWinner);
    return ids;
  }, [queueIds, state?.lastWinner, playersMap]);
  // у чергу: весь пул мінус ті, хто грає, і хто вже в черзі
  const joinPool = useMemo(() => {
    const busyIds = new Set([...queueIds, ...(game ? [game.a, game.b] : [])]);
    return (state?.players ?? []).filter((p) => !busyIds.has(p.id));
  }, [state?.players, queueIds, game]);

  /* --- заставка-вітрина: стіл вільний + жодного тапу ≥2 хв + нічого не відкрито --- */
  const [showcase, setShowcase] = useState(false);
  const lastActRef = useRef(Date.now());
  const hasGame = !!game;
  const loaded = state !== null;
  const overlayOpen = overlay.k !== 'none' || ceremony !== null || demoCeremony || demoFinish;

  useEffect(() => {
    // будь-який тап/дотик будь-де скидає таймер простою
    const act = () => { lastActRef.current = Date.now(); };
    window.addEventListener('pointerdown', act, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', act, { capture: true });
  }, []);

  useEffect(() => {
    if (!loaded || hasGame || overlayOpen) { setShowcase(false); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // заставку не запускаємо взагалі
    const idleMs = demo === 'idle' ? IDLE_DEMO_MS : IDLE_MS;
    const t = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastActRef.current >= idleMs) setShowcase(true);
    }, 1000);
    return () => clearInterval(t);
  }, [loaded, hasGame, overlayOpen, demo]);

  // подіум для заставки: топ-3 «за весь час» з поточного стану (рейтинги живі)
  const top3 = useMemo(
    () => (state?.leaderboard ?? []).slice(0, 3).map((r) => ({ p: P(r.id), rating: r.rating ?? 1000 })),
    [state?.leaderboard, P],
  );

  const queueForPanel = demoQueue ? mockQueue : queuePlayers;

  /* ---------- рендер ---------- */
  return (
    <div className="kiosk">
      {/* декор */}
      <span className="k-deco ring" style={{ width: 190, height: 190, top: -70, right: '30%', background: 'var(--yellow)', opacity: .55 }} />
      {/* бірюзове кільце живе вгорі, у зазорі між колонками — щоб ніколи
          не лягало на інтерактивні кнопки внизу сцени */}
      <span className="k-deco ring" style={{ width: 64, height: 64, top: 118, left: '57%', background: 'var(--cyan)' }} />
      <span className="k-deco dotgrid" style={{ width: 180, height: 120, bottom: -14, left: -20, transform: 'rotate(-8deg)' }} />

      <div className="k-top">
        <span className="k-brand"><i className="ttball sm" />{BRAND} · СТІЛ</span>
        {offline && <span className="k-offline"><i />офлайн</span>}
        <nav className="k-tabs" aria-label="Розділи">
          <button className={'k-tab' + (tab === 'table' ? ' on' : '')} onClick={() => setTab('table')}>СТІЛ</button>
          <button className={'k-tab' + (tab === 'board' ? ' on' : '')} onClick={() => setTab('board')}>ЛІДЕРБОРД</button>
        </nav>
      </div>

      {toast && <div className="k-toast" role="status">{toast}</div>}

      {state === null ? (
        <div className="k-loading">
          <i className="ttball bounce" style={{ width: 54, height: 54 }} />
          <p>ЗАВАНТАЖУЮ СТІЛ…</p>
        </div>
      ) : tab === 'board' ? (
        <Leaderboard rows={state.leaderboard} weekly={state.weekly} players={playersMap} recent={state.recent} />
      ) : game ? (
        /* ================= ГРА ЙДЕ ================= */
        <div className="k-stage">
          <div className="k-col">
            <div className="k-live">
              <div className="k-live-top">
                <span className="k-kicker"><span className="dot" />гра йде</span>
              </div>
              <div className="k-versus">
                {([['a', game.a], ['b', game.b]] as const).map(([side, id], idx) => {
                  const p = P(id);
                  return (
                    <div className={'k-side ' + side} key={side} style={{ order: idx === 0 ? 0 : 2 }}>
                      <span className="corner" />
                      <div className="k-art">
                        <HeroArt src={p.hero?.art} alt={p.nickname} color={p.hero?.color || 'var(--yellow)'}
                          initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={170} radius={24}
                          pending={!p.hero?.art && isArtPending(p.id)} />
                      </div>
                      <div className="nick"><NickFit nick={p.nickname || p.name} /></div>
                      {p.rating != null && <div className="k-side-rate"><RatingChip rating={p.rating} /></div>}
                      <div className="who">{p.name}</div>
                    </div>
                  );
                })}
                <div className="k-vs-mid" style={{ order: 1 }}>
                  <div className="k-vs-burst">VS</div>
                  <div className="k-timer">{clockFrom(game.started_at, now)}</div>
                </div>
              </div>
              <OddsBar ra={P(game.a).rating ?? 1000} rb={P(game.b).rating ?? 1000} />
              <div className="k-live-actions">
                <div className="row">
                  <button className="kbtn xl pink" disabled={busy}
                    onClick={() => setOverlay({ k: 'score', gameId: game.id, aId: game.a, bId: game.b })}>ГРА ЗАКІНЧИЛАСЬ</button>
                  <button className="kbtn lg cyan" disabled={busy} onClick={() => setOverlay({ k: 'pick-queue' })}>ЗАПИСАТИСЬ<br />У ЧЕРГУ</button>
                </div>
                <CancelGameButton busy={busy} onCancel={() => { void run(() => cancelGame(game.id)); }} />
              </div>
            </div>
          </div>
          <QueuePanel queue={queueForPanel} busy={busy} onLeave={onLeave} />
        </div>
      ) : (
        /* ================= СТІЛ ВІЛЬНИЙ ================= */
        <div className="k-stage">
          <div className="k-col">
            <div className="k-free">
              <span className="k-kicker"><span className="dot" />живе табло клубу</span>
              <h1 className="k-hl">
                СТІЛ<br /><span className="stroke">ВІЛЬНИЙ</span>
                <Squiggle />
              </h1>
              <div className="k-actions">
                <button className="kbtn xl pink" disabled={busy} onClick={() => setOverlay({ k: 'pick-start' })}>СТАТИ ДО СТОЛУ</button>
                <button className="kbtn lg cyan" disabled={busy} onClick={() => setOverlay({ k: 'pick-queue' })}>ЗАПИСАТИСЬ У ЧЕРГУ</button>
              </div>
              {state.lastWinner && (
                <span className="k-lastwin">
                  <CupIcon /> минулу гру {byGender(P(state.lastWinner), 'виграв', 'виграла')} <b>@{P(state.lastWinner).nickname}</b>
                </span>
              )}
            </div>
          </div>
          <QueuePanel queue={queueForPanel} busy={busy} onLeave={onLeave} />
        </div>
      )}

      {/* ---------- оверлеї ---------- */}
      {overlay.k === 'pick-start' && state && (
        <PlayerPicker
          players={state.players}
          allowedIds={startAllowed}
          count={2}
          preselected={queueIds.slice(0, 2)}
          title="ХТО ГРАЄ?"
          confirmLabel="РОЗПОЧАТИ ГРУ"
          quickAdd
          onClose={closeOverlay}
          onConfirm={async (ids) => {
            const ok = await run(() => startGame(ids[0], ids[1]));
            if (ok) closeOverlay();
          }}
        />
      )}
      {overlay.k === 'pick-queue' && state && (
        <PlayerPicker
          players={joinPool}
          count={2}
          minCount={1}
          title="ХТО В ЧЕРГУ?"
          confirmLabel="У ЧЕРГУ"
          quickAdd
          onClose={closeOverlay}
          onConfirm={async (ids) => {
            // можна вдвох: записуємо послідовно, порядок вибору = порядок у черзі
            const ok = await run(async () => { for (const id of ids) await joinQueue(id); });
            if (ok) closeOverlay();
          }}
        />
      )}
      {overlay.k === 'score' && (
        <ScoreEntry
          a={P(overlay.aId)}
          b={P(overlay.bId)}
          onCancel={closeOverlay}
          onSubmit={async (sets) => {
            const { gameId, aId, bId } = overlay;
            const pre = stateRef.current; // знімок ДО finish: рейтинги і топ для церемонії
            let winnerId = '';
            let delta = 0;
            const ok = await run(async () => {
              const r = await finishGame(gameId, sets);
              winnerId = r.winner;
              delta = r.delta;
            });
            if (!ok) {
              // тимчасовий збій → лишаємо введений рахунок для повтору;
              // закриваємось тільки якщо гру вже закрили з іншого екрана
              finishFailsRef.current += 1;
              if (finishFailsRef.current >= 2) // повторний збій — чесна ескалація
                setToast('Знову не зберігається — сфоткай рахунок і скажи адміну');
              if (stateRef.current?.game?.id !== gameId) closeOverlay();
              return;
            }
            finishFailsRef.current = 0;
            const post = stateRef.current; // run уже зробив refetch
            const freshQueue = post?.queue ?? [];
            const next = freshQueue.length > 0 && winnerId
              ? { winnerId, loserId: winnerId === aId ? bId : aId, sets }
              : null;

            if (!winnerId || delta <= 0) { // захисний шлях: без даних — старий флоу
              closeOverlay();
              if (next) setOverlay({ k: 'next', ...next });
              return;
            }

            // ліга: рейтинг переможця до гри — з pre-знімка
            const prevRating = pre?.players.find((p) => p.id === winnerId)?.rating ?? 1000;
            const newRating = prevRating + delta;
            const leagueUp = leagueOf(newRating).name !== leagueOf(prevRating).name;

            // «обійшов»: позиція в топі «весь час» покращилась відносно pre-топу
            let overtook: string | null = null;
            if (pre && post) {
              const preIdx = pre.leaderboard.findIndex((r) => r.id === winnerId);
              const preRank = preIdx === -1 ? pre.leaderboard.length : preIdx;
              const postIdx = post.leaderboard.findIndex((r) => r.id === winnerId);
              if (postIdx !== -1 && postIdx < preRank) {
                const passed = pre.leaderboard
                  .slice(0, preRank)
                  .filter((r) => post.leaderboard.findIndex((x) => x.id === r.id) > postIdx);
                if (passed.length > 0) {
                  const p = playersMap.get(passed[0].id);
                  overtook = p?.nickname || p?.name || null;
                }
              }
            }

            closeOverlay();
            setCeremony({ winner: P(winnerId), delta, newRating, leagueUp, overtook, next });
          }}
        />
      )}
      {overlay.k === 'next' && (
        <WhoNext
          winner={P(overlay.winnerId)}
          loser={P(overlay.loserId)}
          sets={overlay.sets}
          queue={queuePlayers}
          onLater={closeOverlay}
          onStart={async (a, b) => {
            const ok = await run(() => startGame(a, b));
            if (ok) closeOverlay();
          }}
        />
      )}
      {ceremony && (
        <Ceremony
          data={ceremony}
          onDone={() => {
            const next = ceremony.next;
            setCeremony(null);
            if (next) setOverlay({ k: 'next', ...next }); // далі — незмінний флоу «Хто далі?»
          }}
        />
      )}
      {!ceremony && demoCeremony && (
        <Ceremony
          data={{
            winner: { ...FALLBACK_PLAYER('demo'), nickname: 'DEMO_HERO', name: 'Демо' },
            delta: 21, newRating: 1058, leagueUp: true, overtook: 'SPINZILLA',
          }}
          onDone={() => setDemoCeremony(false)}
        />
      )}
      {/* демо швидкого фінішу: моки + console.log замість finishGame — БД не чіпається */}
      {demoFinish && (
        <ScoreEntry
          a={{ ...FALLBACK_PLAYER('demo-a'), nickname: 'SPINZILLA', name: 'Оля', rating: 1043,
            hero: { color: 'var(--cyan)', shape: 'circle', emblem: '★', style: 'spinner' } }}
          b={{ ...FALLBACK_PLAYER('demo-b'), nickname: 'BLOKARENKO', name: 'Артем', rating: 987,
            hero: { color: 'var(--pink)', shape: 'circle', emblem: '★', style: 'defender' } }}
          onCancel={() => setDemoFinish(false)}
          onSubmit={async (sets) => {
            // еталон перевірки payload: порядок a:b, як у finishGame
            console.log('[demo:finish] onSubmit sets payload =', JSON.stringify(sets));
          }}
        />
      )}
      {/* заставка-вітрина: монтуємо лише коли стіл вільний і нічого не відкрито */}
      {showcase && loaded && !hasGame && !overlayOpen && (
        <Showcase top3={top3}
          onDismiss={() => { lastActRef.current = Date.now(); setShowcase(false); }} />
      )}
    </div>
  );
}

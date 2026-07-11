'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TableState } from '@/lib/table/state';
import type { Player, SetScore } from '@/lib/tournament/types';
import { getTableState, startGame, finishGame, joinQueue, cancelGame, leaveQueue } from '@/lib/table/api';
import HeroArt from '@/components/HeroArt';
import PlayerPicker from '@/components/table/PlayerPicker';
import ScoreEntry from '@/components/table/ScoreEntry';
import WhoNext from '@/components/table/WhoNext';
import Leaderboard from '@/components/table/Leaderboard';
import { useArmed, NickFit, RatingChip } from '@/components/table/bits';
import { BRAND } from '@/config';

type Overlay =
  | { k: 'none' }
  | { k: 'pick-start' }
  | { k: 'pick-queue' }
  | { k: 'score'; gameId: string; aId: string; bId: string }
  | { k: 'next'; winnerId: string; loserId: string; sets: SetScore[] };

/* ---------- дрібні хелпери ---------- */

const POLL_MS = 3000;

const ERR_TEXT: Record<string, string> = {
  timeout: 'Немає звʼязку — спробуй ще раз',
  state_failed: 'Немає звʼязку — спробуй ще раз',
  nick_taken: 'Такий нік уже є — зміни імʼя',
};
const errText = (code: string) => ERR_TEXT[code] ?? 'Стан змінився — синхронізуюсь';

function clockFrom(startedAt: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const POS_COLORS = ['var(--lime)', 'var(--cyan)', 'var(--yellow)', 'var(--pink)', 'var(--purple)', 'var(--coral)', 'var(--blue)'];

const FALLBACK_PLAYER = (id: string): Player => ({
  id, name: '?', nickname: '· · ·', seed: 0,
  hero: { color: 'var(--yellow)', shape: 'circle', emblem: '★', style: 'allrounder' },
});

/* ---------- декоративний squiggle (крафтовий SVG) ---------- */
function Squiggle({ color = 'var(--pink)' }: { color?: string }) {
  return (
    <svg className="squig" viewBox="0 0 280 28" fill="none" aria-hidden="true">
      <path d="M4 20 Q 22 4, 40 16 T 76 16 T 112 16 T 148 16 T 184 16 T 220 16 T 256 16 L 276 10"
        stroke={color} strokeWidth="7" strokeLinecap="round" />
    </svg>
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
  const [armed, fire] = useArmed();
  return (
    <div className="k-qrow">
      <span className="k-qpos" style={{ background: POS_COLORS[i % POS_COLORS.length] }}>{i + 1}</span>
      <span className="k-qname">
        {i === 0 && <span className="k-qnext">наступний</span>}
        <NickFit nick={p.nickname || p.name} oneLine />
      </span>
      <button className={'k-qx' + (armed ? ' armed' : '')} disabled={busy}
        aria-label={`Прибрати ${p.nickname} з черги`}
        onClick={() => fire(() => onLeave(p.id))}>
        {armed ? 'Точно?' : '✕'}
      </button>
    </div>
  );
}

function QueuePanel({ queue, busy, onLeave }: { queue: Player[]; busy: boolean; onLeave: (id: string) => void }) {
  return (
    <aside className="k-queue">
      <div className="k-queue-head">
        <h2>ЧЕРГА</h2>
        <span className="k-queue-count">{queue.length}</span>
      </div>
      {queue.length === 0 ? (
        <div className="k-queue-empty">
          <i className="ttball bounce" />
          <p>Черга порожня — стіл чекає на тебе</p>
        </div>
      ) : (
        <div className="k-queue-list">
          {queue.map((p, i) => <QueueRow key={p.id} p={p} i={i} busy={busy} onLeave={onLeave} />)}
        </div>
      )}
    </aside>
  );
}

/* ---------- кнопка «Скасувати гру» (подвійний тап) ---------- */
function CancelGameButton({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  const [armed, fire] = useArmed();
  return (
    <button className={'kbtn ghost-danger' + (armed ? ' armed' : '')} disabled={busy}
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
  }, [refetch]);

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

  const onLeave = useCallback((id: string) => { void run(() => leaveQueue(id)); }, [run]);

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
        <Leaderboard rows={state.leaderboard} players={playersMap} recent={state.recent} />
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
                          initial={(p.nickname || p.name || '?').charAt(0).toUpperCase()} size={170} radius={24} />
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
          <QueuePanel queue={queuePlayers} busy={busy} onLeave={onLeave} />
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
                  <CupIcon /> минулу гру виграв <b>@{P(state.lastWinner).nickname}</b>
                </span>
              )}
            </div>
          </div>
          <QueuePanel queue={queuePlayers} busy={busy} onLeave={onLeave} />
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
          count={1}
          title="ХТО В ЧЕРГУ?"
          confirmLabel="Я В ЧЕРЗІ"
          quickAdd
          onClose={closeOverlay}
          onConfirm={async (ids) => {
            const ok = await run(() => joinQueue(ids[0]));
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
            let winnerId = '';
            const ok = await run(async () => {
              const r = await finishGame(gameId, sets);
              winnerId = r.winner;
            });
            if (!ok) {
              // тимчасовий збій → лишаємо введений рахунок для повтору;
              // закриваємось тільки якщо гру вже закрили з іншого екрана
              if (stateRef.current?.game?.id !== gameId) closeOverlay();
              return;
            }
            const freshQueue = stateRef.current?.queue ?? [];
            if (freshQueue.length > 0 && winnerId) {
              setOverlay({ k: 'next', winnerId, loserId: winnerId === aId ? bId : aId, sets });
            } else {
              closeOverlay();
            }
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
    </div>
  );
}

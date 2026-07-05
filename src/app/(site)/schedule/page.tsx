'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Match, Player, Tournament } from '@/lib/tournament/types';
import { getState } from '@/lib/api';
import MatchCard from '@/components/app/MatchCard';
import ScoreModal from '@/components/app/ScoreModal';

/**
 * Розклад поточного туру швейцарки.
 *
 * Клієнтський компонент: на маунті тягне снапшот через getState() та визначає
 * mineId за токеном з localStorage (`tt_token`) через GET /api/me/{token}.
 * Показує матчі поточного туру (tournament.current_round) як MatchCard —
 * мій матч іде першим і підсвічений (.mine). Чип «зіграно X/Y» рахує reported.
 * Натиск «Вписати рахунок» відкриває ScoreModal (лише для свого pending-матчу).
 *
 * Edge-стани: завантаження, помилка, статус `registration` (турнір ще не
 * почався), відсутність матчів у поточному турі.
 */
export default function SchedulePage() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [mineId, setMineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Match | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const state = await getState();
      setTournament(state.tournament);
      setPlayers(state.players);
      setMatches(state.matches);
    } catch {
      setError('Не вдалося завантажити дані турніру.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial snapshot.
  useEffect(() => {
    void load();
  }, [load]);

  // Resolve my player id from the stored token via /api/me/{token}.
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('tt_token') : null;
    if (!t) return;
    setToken(t);
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/me/${t}`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json().catch(() => null)) as { id?: string } | null;
        if (!cancelled && data?.id) setMineId(data.id);
      } catch {
        // mineId stays null — page still works, just nothing highlighted.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const started = tournament != null && tournament.status !== 'registration';
  const round = tournament?.current_round ?? 0;

  // Matches of the current swiss round, mine first.
  const roundMatches = matches
    .filter((m) => m.stage === 'swiss' && m.round === String(round))
    .sort((a, b) => {
      const aMine = mineId != null && (a.a === mineId || a.b === mineId);
      const bMine = mineId != null && (b.a === mineId || b.b === mineId);
      if (aMine !== bMine) return aMine ? -1 : 1;
      return a.slot - b.slot;
    });

  const total = roundMatches.length;
  const played = roundMatches.filter((m) => m.status === 'reported').length;

  const canScore = mineId != null && token != null;

  function onEnter(m: Match) {
    if (!canScore) return;
    setActive(m);
  }

  function onDone() {
    setActive(null);
    setLoading(true);
    void load();
  }

  return (
    <main>
      <section>
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow alt">Розклад</span>
            <h2 className="title">Поточний тур</h2>
            <p className="lead">
              Пари швейцарки цього туру. Зіграв — впиши рахунок свого матчу
              (до 3 виграних партій), і таблиця оновиться сама.
            </p>
          </div>

          <div className="reveal d1" style={{ marginTop: 28 }}>
            {loading ? (
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="lead" style={{ margin: 0 }}>
                  Завантаження…
                </p>
              </div>
            ) : error ? (
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip pink" style={{ marginBottom: 14 }}>
                  Помилка
                </span>
                <p className="lead" style={{ margin: 0 }}>
                  {error}
                </p>
              </div>
            ) : !started ? (
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip live" style={{ marginBottom: 14 }}>
                  Очікуємо
                </span>
                <p className="lead" style={{ margin: 0 }}>
                  Турнір ще не почався.
                </p>
              </div>
            ) : total === 0 ? (
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip live" style={{ marginBottom: 14 }}>
                  Тур {round}
                </span>
                <p className="lead" style={{ margin: 0 }}>
                  Пари цього туру ще не сформовані. Зазирни трохи згодом.
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 22,
                  }}
                >
                  <span className="chip">Тур {round}</span>
                  <span className={`chip${played === total ? ' win' : ' live'}`}>
                    зіграно {played}/{total}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  {roundMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      players={players}
                      mineId={mineId ?? undefined}
                      onEnter={
                        canScore && (m.a === mineId || m.b === mineId) ? onEnter : undefined
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {active && token && (
        <ScoreModal
          match={active}
          players={players}
          token={token}
          onClose={() => setActive(null)}
          onDone={onDone}
        />
      )}
    </main>
  );
}

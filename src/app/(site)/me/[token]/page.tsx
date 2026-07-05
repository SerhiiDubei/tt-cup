'use client';

import { use, useEffect, useMemo, useState } from 'react';
import HeroCard from '@/components/HeroCard';
import MatchCard from '@/components/app/MatchCard';
import ScoreModal from '@/components/app/ScoreModal';
import { getState } from '@/lib/api';
import type { Match, Player, Tournament } from '@/lib/tournament/types';

type Loaded = {
  me: Player;
  tournament: Tournament;
  players: Player[];
  matches: Match[];
};

/**
 * Приватний кабінет гравця за токен-лінком (/me/[token]).
 *
 * Клієнтський компонент: читає токен із params (Next 15 — Promise → React.use),
 * зберігає його у localStorage під ключем `tt_token`, дізнається свій id через
 * /api/me/[token], тягне снапшот турніру через getState(), і показує власну
 * HeroCard + свої матчі (MatchCard → ScoreModal для вписування рахунку).
 */
export default function MePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Match | null>(null);

  // Запамʼятати токен як приватну особистість гравця.
  useEffect(() => {
    if (token) {
      try {
        localStorage.setItem('tt_token', token);
      } catch {
        /* приватний режим — ігноруємо */
      }
    }
  }, [token]);

  // Завантажити «мене» + снапшот турніру.
  async function load() {
    setError(null);
    try {
      const [meRes, state] = await Promise.all([
        fetch(`/api/me/${token}`, { cache: 'no-store' }),
        getState(),
      ]);
      if (meRes.status === 404) {
        setData(null);
        setError('not_found');
        return;
      }
      if (!meRes.ok) throw new Error(`HTTP ${meRes.status}`);
      const { player } = (await meRes.json()) as { player: Player };
      setData({
        me: player,
        tournament: state.tournament,
        players: state.players,
        matches: state.matches,
      });
    } catch {
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const me = data?.me;

  // Усі мої матчі: спершу не зіграні, далі — за раундом.
  const myMatches = useMemo(() => {
    if (!data || !me) return [] as Match[];
    return data.matches
      .filter((m) => m.a === me.id || m.b === me.id)
      .sort((x, y) => {
        const px = x.status === 'reported' ? 1 : 0;
        const py = y.status === 'reported' ? 1 : 0;
        if (px !== py) return px - py;
        return x.round.localeCompare(y.round, undefined, { numeric: true });
      });
  }, [data, me]);

  const pending = myMatches.filter((m) => m.status === 'pending' && m.b != null);
  const notStarted = !data || data.tournament?.status === 'registration';

  return (
    <main>
      <section>
        <div className="wrap">
          <div className="reveal in">
            <span className="eyebrow">Твій кабінет</span>
            <h2 className="title">{me ? me.name : 'Гравець'}</h2>
            <p className="lead">
              Тут — твоя картка героя та особисті матчі. Зіграв партію — впиши рахунок,
              і таблиця оновиться автоматично.
            </p>
          </div>

          {loading ? (
            <div className="reveal d1 in" style={{ marginTop: 28 }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="lead" style={{ margin: 0 }}>
                  Завантажуємо твій профіль…
                </p>
              </div>
            </div>
          ) : error === 'not_found' ? (
            <div className="reveal d1 in" style={{ marginTop: 28 }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip pink" style={{ marginBottom: 14 }}>
                  Невідомий лінк
                </span>
                <p className="lead" style={{ margin: '0 auto 18px' }}>
                  За цим токеном гравця не знайдено. Можливо, лінк застарів або скопійований
                  не повністю.
                </p>
                <a className="btn pink" href="/">
                  Створити героя
                </a>
              </div>
            </div>
          ) : error ? (
            <div className="reveal d1 in" style={{ marginTop: 28 }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip" style={{ marginBottom: 14 }}>
                  Помилка
                </span>
                <p className="lead" style={{ margin: '0 auto 18px' }}>
                  Не вдалося завантажити дані. Перевір зʼєднання і спробуй ще раз.
                </p>
                <button type="button" className="btn cyan" onClick={() => load()}>
                  Спробувати знову
                </button>
              </div>
            </div>
          ) : me ? (
            <>
              <div
                className="reveal d1 in"
                style={{
                  marginTop: 28,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,280px) minmax(0,1fr)',
                  gap: 24,
                  alignItems: 'start',
                }}
              >
                <div>
                  <HeroCard
                    name={me.name}
                    nickname={me.nickname}
                    hero={me.hero}
                    motto={me.motto}
                    rank={me.seed ? `СІД #${me.seed}` : undefined}
                  />
                </div>

                <div className="card">
                  <span className="eyebrow alt">Статус</span>
                  <h3
                    className="title"
                    style={{ fontSize: 26, margin: '6px 0 12px' }}
                  >
                    {notStarted
                      ? 'Реєстрація триває'
                      : data!.tournament.status === 'swiss'
                        ? `Швейцарка · тур ${data!.tournament.current_round}`
                        : data!.tournament.status === 'playoff'
                          ? 'Плей-офф · топ-8'
                          : 'Турнір завершено'}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <span className="chip">Матчів: {myMatches.length}</span>
                    {!notStarted && (
                      <span className="chip live">До гри: {pending.length}</span>
                    )}
                  </div>
                  <p className="lead" style={{ margin: '16px 0 0' }}>
                    {notStarted
                      ? 'Турнір ще не стартував — щойно адмін запустить швейцарку, тут зʼявляться твої пари.'
                      : pending.length > 0
                        ? 'Є зіграні партії? Вписуй рахунок у своїх матчах нижче.'
                        : 'Усі твої матчі цього етапу впорядковані. Чекай на наступний тур.'}
                  </p>
                </div>
              </div>

              <div className="reveal d2 in" style={{ marginTop: 36 }}>
                <span className="eyebrow">Мої матчі</span>
                <h3 className="title" style={{ fontSize: 28, margin: '6px 0 18px' }}>
                  Розклад і результати
                </h3>

                {notStarted ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <span className="chip live" style={{ marginBottom: 14 }}>
                      Скоро
                    </span>
                    <p className="lead" style={{ margin: 0 }}>
                      Пари зʼявляться після старту першого туру.
                    </p>
                  </div>
                ) : myMatches.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center' }}>
                    <p className="lead" style={{ margin: 0 }}>
                      Для тебе ще немає матчів у цьому етапі.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                      gap: 18,
                    }}
                  >
                    {myMatches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        players={data!.players}
                        mineId={me.id}
                        onEnter={(match) => setEditing(match)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {editing && me && data && (
        <ScoreModal
          match={editing}
          players={data.players}
          token={token}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </main>
  );
}

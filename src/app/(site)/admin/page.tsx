'use client';

import { useEffect, useState, useCallback } from 'react';
import { getState, admin } from '@/lib/api';
import type { Tournament, Match } from '@/lib/tournament/types';

type StateData = { tournament: Tournament; matches: Match[] };

/** Human-readable label for the tournament status. */
const STATUS_LABEL: Record<Tournament['status'], string> = {
  registration: 'Реєстрація',
  swiss: 'Швейцарка',
  playoff: 'Плей-офф',
  done: 'Завершено',
};

const STATUS_CHIP: Record<Tournament['status'], string> = {
  registration: 'chip live',
  swiss: 'chip pink',
  playoff: 'chip',
  done: 'chip win',
};

/** Count reported vs total matches inside a single round of the current stage. */
function roundProgress(matches: Match[], stage: 'swiss' | 'playoff', round: string) {
  const inRound = matches.filter((m) => m.stage === stage && m.round === round);
  const played = inRound.filter((m) => m.status === 'reported').length;
  return { played, total: inRound.length };
}

/** Pick the last (highest) playoff round that currently has matches. */
function lastPlayoffRound(matches: Match[]): string | null {
  const order = ['QF', 'SF', 'F', 'BR'];
  const present = matches.filter((m) => m.stage === 'playoff').map((m) => m.round);
  let found: string | null = null;
  for (const r of order) if (present.includes(r)) found = r;
  return found;
}

export default function AdminPage() {
  const [code, setCode] = useState('');
  const [authed, setAuthed] = useState(false);
  const [state, setState] = useState<StateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getState();
      setState({ tournament: s.tournament, matches: s.matches });
      setError(null);
    } catch {
      setError('Не вдалося завантажити стан турніру.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: 'start' | 'next-round' | 'to-playoff' | 'advance' | 'reset', label: string) => {
      if (!code.trim()) {
        setError('Спершу введіть код адміна.');
        return;
      }
      setBusy(action);
      setResult(null);
      setError(null);
      try {
        await admin(action, code.trim());
        setResult(`Готово: ${label}.`);
        await refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        setError(msg === 'HTTP 401' ? 'Невірний код адміна.' : `Помилка: ${msg}`);
      } finally {
        setBusy(null);
      }
    },
    [code, refresh],
  );

  const tournament = state?.tournament;
  const matches = state?.matches ?? [];

  return (
    <main>
      <section>
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow alt">Панель адміна</span>
            <h2 className="title" style={{ marginTop: 16 }}>
              Керування турніром
            </h2>
            <p className="lead" style={{ marginTop: 14 }}>
              Введіть код, щоб бачити стан і керувати ходом турніру: старт, наступні тури,
              перехід у плей-офф та просування сітки.
            </p>
          </div>

          {/* Auth / code form */}
          <div className="card reveal d1" style={{ marginTop: 36, maxWidth: 520 }}>
            <div className="field">
              <label htmlFor="admin-code">Код адміна</label>
              <input
                id="admin-code"
                className="input"
                type="password"
                value={code}
                placeholder="••••••"
                autoComplete="off"
                onChange={(e) => {
                  setCode(e.target.value);
                  setAuthed(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAuthed(!!code.trim());
                }}
              />
            </div>
            <button
              type="button"
              className="btn blue"
              disabled={!code.trim()}
              onClick={() => setAuthed(!!code.trim())}
            >
              {authed ? 'Код збережено' : 'Підтвердити код'}
            </button>
            {!authed && (
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-soft)' }}>
                Дії стають доступні після введення коду. Невірний код відхилить сервер.
              </p>
            )}
          </div>

          {/* Status + actions */}
          {authed && (
            <div className="card reveal d2" style={{ marginTop: 24 }}>
              {loading && !tournament ? (
                <p style={{ color: 'var(--ink-soft)' }}>Завантаження стану…</p>
              ) : !tournament ? (
                <p style={{ color: 'var(--ink-soft)' }}>
                  Дані турніру відсутні. Перевірте підключення до бази.
                </p>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 14,
                      marginBottom: 20,
                    }}
                  >
                    <span className={STATUS_CHIP[tournament.status]}>
                      {STATUS_LABEL[tournament.status]}
                    </span>
                    {tournament.status === 'swiss' && (
                      <span style={{ fontWeight: 700 }}>
                        Тур {tournament.current_round} / {tournament.total_rounds}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ marginLeft: 'auto', fontSize: 13, padding: '9px 16px' }}
                      onClick={() => void refresh()}
                      disabled={loading}
                    >
                      Оновити
                    </button>
                  </div>

                  <AdminActions
                    tournament={tournament}
                    matches={matches}
                    busy={busy}
                    onRun={run}
                  />
                </>
              )}
            </div>
          )}

          {/* Result / error feedback */}
          {(result || error) && (
            <div className="card reveal d3" style={{ marginTop: 20, maxWidth: 520 }}>
              {result && (
                <p style={{ fontWeight: 700, color: 'var(--ink)' }}>{result}</p>
              )}
              {error && (
                <p style={{ fontWeight: 700, color: 'var(--coral)' }}>{error}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/** Context-sensitive action buttons driven by the current tournament status. */
function AdminActions({
  tournament,
  matches,
  busy,
  onRun,
}: {
  tournament: Tournament;
  matches: Match[];
  busy: string | null;
  onRun: (
    action: 'start' | 'next-round' | 'to-playoff' | 'advance' | 'reset',
    label: string,
  ) => void;
}) {
  const disabled = busy != null;
  const btnStyle = { marginRight: 12, marginBottom: 12 } as const;

  let primary: React.ReactNode = null;

  if (tournament.status === 'registration') {
    primary = (
      <button
        type="button"
        className="btn pink"
        style={btnStyle}
        disabled={disabled}
        onClick={() => onRun('start', 'турнір розпочато')}
      >
        {busy === 'start' ? 'Стартуємо…' : 'Почати турнір'}
      </button>
    );
  } else if (tournament.status === 'swiss') {
    const round = String(tournament.current_round);
    const { played, total } = roundProgress(matches, 'swiss', round);
    const complete = total > 0 && played === total;
    const isLastRound = tournament.current_round >= tournament.total_rounds;
    primary = (
      <>
        <div style={{ marginBottom: 16, fontWeight: 700 }}>
          Зіграно {played}/{total}
        </div>
        {isLastRound ? (
          <button
            type="button"
            className="btn cyan"
            style={btnStyle}
            disabled={disabled || !complete}
            onClick={() => onRun('to-playoff', 'перехід у плей-офф')}
          >
            {busy === 'to-playoff' ? 'Формуємо сітку…' : 'У плей-офф'}
          </button>
        ) : (
          <button
            type="button"
            className="btn blue"
            style={btnStyle}
            disabled={disabled || !complete}
            onClick={() => onRun('next-round', 'наступний тур')}
          >
            {busy === 'next-round' ? 'Зводимо пари…' : 'Наступний тур'}
          </button>
        )}
        {!complete && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            {total === 0
              ? 'Матчі туру ще не створені.'
              : 'Дочекайтесь, поки всі матчі туру будуть зіграні.'}
          </p>
        )}
      </>
    );
  } else if (tournament.status === 'playoff') {
    const round = lastPlayoffRound(matches);
    const prog = round ? roundProgress(matches, 'playoff', round) : { played: 0, total: 0 };
    const complete = prog.total > 0 && prog.played === prog.total;
    primary = (
      <>
        <div style={{ marginBottom: 16, fontWeight: 700 }}>
          Зіграно {prog.played}/{prog.total}
        </div>
        <button
          type="button"
          className="btn pink"
          style={btnStyle}
          disabled={disabled || !complete}
          onClick={() => onRun('advance', 'сітку просунуто')}
        >
          {busy === 'advance' ? 'Просуваємо…' : 'Просунути сітку'}
        </button>
        {!complete && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            Дочекайтесь, поки всі матчі стадії будуть зіграні.
          </p>
        )}
      </>
    );
  } else {
    // done
    primary = (
      <p style={{ fontWeight: 700, marginBottom: 8 }}>
        Турнір завершено. Чемпіона визначено.
      </p>
    );
  }

  return (
    <div>
      {primary}
      <div style={{ marginTop: 24, paddingTop: 20, borderTop: '3px solid var(--line)' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Небезпечна зона</div>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
          Скидання видаляє всі матчі й повертає турнір у реєстрацію.
        </p>
        <button
          type="button"
          className="btn ghost"
          style={{ borderColor: 'var(--coral)', color: 'var(--coral)' }}
          disabled={disabled}
          onClick={() => {
            if (window.confirm('Скинути турнір? Усі матчі буде видалено.')) {
              onRun('reset', 'турнір скинуто');
            }
          }}
        >
          {busy === 'reset' ? 'Скидаємо…' : 'Скинути турнір'}
        </button>
      </div>
    </div>
  );
}

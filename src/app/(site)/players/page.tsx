'use client';

import { useEffect, useState } from 'react';
import { LEVEL_LABEL } from '@/lib/liga';
import CtaSmart from '@/components/liga/CtaSmart';
import LigaLoader from '@/components/liga/LigaLoader';
import { readCache, writeCache } from '@/lib/ligaCache';
import '../../liga.css';

type P = { nick: string; level: number; paid: boolean; volunteer: boolean };

/**
 * /players — гравці ліги (D-038): картки нік + рівень (без контактів).
 * Кеш (D-049) — миттєвий рендер з localStorage; мережа оновлює тихо.
 */
export default function PlayersPage() {
  const [players, setPlayers] = useState<P[] | null>(null);
  const [dbReady, setDbReady] = useState(true);

  useEffect(() => {
    const cached = readCache<P[]>('dbc_cache_players'); // миттєво, без loader
    if (cached) setPlayers(cached);
    fetch('/api/liga-players', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d.players ?? []);
        setDbReady(d.dbReady !== false);
        writeCache('dbc_cache_players', d.players ?? []);
      })
      .catch(() => setPlayers((prev) => prev ?? []));
  }, []);

  return (
    <main className="jn-root insite"><div className="jn-wrap wide">
      <p className="jn-step">ліга · 2–23 серпня</p>
      <h1 className="jn-h1">Гравці</h1>
      <p className="jn-lead">Хто вже вписався в DRUID BATTLE CUP. Рівень — чесна самозаява, її ще перевірить ліга.</p>

      {players === null && <LigaLoader label="Збираю склад ліги…" skeleton />}

      {players !== null && players.length === 0 && (
        <div className="jn-card" style={{ textAlign: 'center' }}>
          <p className="jn-hint" style={{ margin: 0, fontWeight: 700 }}>
            {dbReady ? 'Поки нікого — будь першим!' : '🧪 База ще готується — список зʼявиться ось-ось.'}
          </p>
        </div>
      )}

      {players !== null && players.length > 0 && (
        <div className="jn-roster">
          {players.map((p, i) => (
            <div className="jn-rcard" key={i}>
              <div className="jn-ava sm">{(p.nick[0] ?? '?').toUpperCase()}</div>
              <div className="who">
                <b>{p.nick}</b>
                <span className="jn-chip yellow">{LEVEL_LABEL[p.level] ?? p.level}</span>
                {p.volunteer && <span className="jn-chip lime">🙌</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <CtaSmart />
    </div></main>
  );
}

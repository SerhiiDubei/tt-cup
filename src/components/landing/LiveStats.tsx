'use client';
import { useEffect, useState } from 'react';
import type { Tournament } from '@/lib/tournament/types';

const pad = (n: number) => String(n).padStart(2, '0');

export default function LiveStats({ tournament, count }: { tournament: Tournament; count: number }) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    if (!tournament?.reg_deadline) return;
    const ts = Date.parse(tournament.reg_deadline);
    const tick = () => {
      let ms = Math.max(0, ts - Date.now());
      const d = Math.floor(ms / 86400000); ms -= d * 86400000;
      const h = Math.floor(ms / 3600000); ms -= h * 3600000;
      const m = Math.floor(ms / 60000); ms -= m * 60000;
      setLeft({ d, h, m, s: Math.floor(ms / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tournament?.reg_deadline]);

  const statusLabel = { registration: 'РЕЄСТРАЦІЯ', swiss: 'ШВЕЙЦАРКА', playoff: 'ПЛЕЙ-ОФФ', done: 'ЗАВЕРШЕНО' }[tournament?.status || 'registration'];

  return (
    <section>
      <div className="wrap">
        <div className="stats">
          <div className="stat reveal"><div className="v">{count}</div><div className="l">учасників</div></div>
          <div className="stat reveal d1"><div className="v">{statusLabel}</div><div className="l">статус турніру</div></div>
          <div className="stat reveal d2">
            <div className="v">{tournament?.status === 'swiss' ? `${tournament.current_round}/${tournament.total_rounds}` : '8'}</div>
            <div className="l">{tournament?.status === 'swiss' ? 'поточний тур' : 'турів швейцарки'}</div>
          </div>
          <div className="stat reveal d3"><div className="v">8</div><div className="l">у плей-офф</div></div>
        </div>
        {tournament?.status === 'registration' && left && (
          <div style={{ marginTop: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>до закриття реєстрації</div>
            <div className="count-row">
              {([['днів', left.d], ['год', left.h], ['хв', left.m], ['сек', left.s]] as const).map(([l, v]) => (
                <div className="count-u" key={l}><b>{pad(v)}</b><span>{l}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

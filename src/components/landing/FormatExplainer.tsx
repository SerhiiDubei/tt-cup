'use client';
import { useState } from 'react';

const NAMES = ['Олег', 'Марія', 'Іван', 'Софія', 'Данило', 'Аня', 'Макс', 'Юля'];
function shuffle<T>(a: T[]): T[] { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor((i + 1) * ((Math.sin(i * 9301 + Date.now() % 233) + 1) / 2)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

export default function FormatExplainer() {
  const [tab, setTab] = useState<'reg' | 'swiss' | 'po'>('reg');
  const [round, setRound] = useState(1);
  const [order, setOrder] = useState(NAMES);

  function nextRound() { setOrder(shuffle(order)); setRound((r) => (r % 8) + 1); }

  return (
    <section>
      <div className="wrap">
        <span className="eyebrow alt reveal">як це працює</span>
        <h2 className="title reveal">Формат — <span className="swirl">наживо</span></h2>
        <p className="lead reveal d1" style={{ marginBottom: 28 }}>Клікай етапи. Швейцарку можна «прокрутити» — побачиш, як щотуру міняються пари.</p>

        <div className="fx-tabs reveal d1">
          <button className={'fx-tab' + (tab === 'reg' ? ' on' : '')} onClick={() => setTab('reg')}>1 · Реєстрація</button>
          <button className={'fx-tab' + (tab === 'swiss' ? ' on' : '')} onClick={() => setTab('swiss')}>2 · Швейцарка</button>
          <button className={'fx-tab' + (tab === 'po' ? ' on' : '')} onClick={() => setTab('po')}>3 · Плей-офф</button>
        </div>

        <div className="fx-stage reveal d2">
          {tab === 'reg' && (
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 12 }}>Створюєш героя 🎨</h3>
              <p className="lead">Колір ракетки, форма, стиль гри, девіз — і ти отримуєш свою піксель-картку гравця та приватне посилання, яким вписуватимеш результати.</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                {['🏓 нік + герой', '🪪 картка гравця', '🔗 особисте посилання'].map((t) => <span className="chip" key={t}>{t}</span>)}
              </div>
            </div>
          )}
          {tab === 'swiss' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Тур {round} / 8 · пари за очками</h3>
                <button className="btn cyan" onClick={nextRound}>↻ наступний тур</button>
              </div>
              <div className="fx-pairs">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div className="fx-pair" key={i}>
                    <strong style={{ textAlign: 'right' }}>{order[i * 2]}</strong>
                    <span className="vs">VS</span>
                    <strong>{order[i * 2 + 1]}</strong>
                  </div>
                ))}
              </div>
              <p className="lead" style={{ marginTop: 16 }}>Щотуру суперник — з близькою кількістю очок, без повторів. Перемога = 1 очко.</p>
            </div>
          )}
          {tab === 'po' && (
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 16 }}>Топ-8 → офлайн сітка 🏆</h3>
              <div className="bracket" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
                {[['1/4', 4], ['1/2', 2], ['ФІНАЛ', 1]].map(([lbl, n]) => (
                  <div className="bcol" key={lbl as string}>
                    <h4>{lbl}</h4>
                    {Array.from({ length: n as number }).map((_, i) => (
                      <div className="bmatch" key={i}>
                        <div className="br"><span><span className="seed">{i * 2 + 1}</span>гравець</span><span>—</span></div>
                        <div className="br"><span><span className="seed">{i * 2 + 2}</span>гравець</span><span>—</span></div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="lead" style={{ marginTop: 16 }}>Найкращі 8 за швейцаркою грають офлайн: 1/4 → 1/2 → фінал + матч за 3-тє.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

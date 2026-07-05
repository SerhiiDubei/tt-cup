const RULES = [
  { n: '🏓', t: 'Best of 5', d: 'Матч до 3 виграних сетів. Рахунок вписуєте самі — по сетах.', c: 'var(--pink)' },
  { n: '🔁', t: 'Швейцарка, 8 турів', d: 'Щотуру — суперник із близькою кількістю очок, без повторів пар.', c: 'var(--cyan)' },
  { n: '📊', t: 'Чесна таблиця', d: 'Тайбрейки: очки → Бухгольц → різниця сетів. Топ-8 — у плей-офф.', c: 'var(--yellow)' },
  { n: '🏆', t: 'Офлайн фінал', d: 'Топ-8 грають сітку наживо: 1/4 → 1/2 → фінал + матч за 3-тє.', c: 'var(--lime)' },
];

export default function Rules() {
  return (
    <section>
      <div className="wrap">
        <span className="eyebrow reveal">правила</span>
        <h2 className="title reveal">Просто та <span className="swirl">чесно</span></h2>
        <div className="grid-auto" style={{ marginTop: 28 }}>
          {RULES.map((r, i) => (
            <div className={'fcard reveal d' + (i + 1)} key={r.t}>
              <div className="n" style={{ color: r.c }}>{r.n}</div>
              <h3>{r.t}</h3>
              <p>{r.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

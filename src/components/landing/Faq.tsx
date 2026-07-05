const FAQ = [
  ['Скільки коштує участь?', 'Нічого. Турнір безкоштовний — просто зареєструйся до дедлайну.'],
  ['Як вписувати рахунок?', 'Після реєстрації отримуєш особисте посилання. У ньому бачиш свій матч і вписуєш рахунок по сетах.'],
  ['Що як я програю кілька матчів?', 'Швейцарка не вибуває — граєш усі 8 турів. У плей-офф виходять найкращі 8 за очками.'],
  ['Коли і де фінал?', 'Топ-8 за груповим етапом грають офлайн-сітку. Дату та локацію організатор повідомить окремо.'],
  ['Можна змінити картку героя?', 'Картка фіксується при реєстрації. Якщо помилився — напиши організатору.'],
];

export default function Faq() {
  return (
    <section>
      <div className="wrap" style={{ maxWidth: 820 }}>
        <span className="eyebrow alt reveal">питання</span>
        <h2 className="title reveal">FAQ</h2>
        <div style={{ marginTop: 24 }}>
          {FAQ.map(([q, a], i) => (
            <details className={'card reveal d' + ((i % 3) + 1)} key={q} style={{ marginBottom: 14, padding: '4px 22px' }}>
              <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '20px 0', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                {q}<span style={{ fontWeight: 400 }}>+</span>
              </summary>
              <p style={{ paddingBottom: 22, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

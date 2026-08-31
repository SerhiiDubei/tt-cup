'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * БРИФ-ОПИТУВАЛЬНИК онбордингу (/brief) — HTML-форма замість md-файлу.
 * Автосейв у localStorage; «Зберегти у проєкт» пише BRIEF_ANSWERS.md на диск
 * (локально), «Скачати .md» — фолбек для проду/телефона.
 */

type Q = { id: string; q: string; hint?: string };
type Sec = { t: string; note?: string; qs: Q[] };

const SECS: Sec[] = [
  {
    t: '0 · Точка входу (те, що вже існує)',
    note: 'Стартуємо від реальності: перша процедурна анімація вже є.',
    qs: [
      { id: '0.1', q: 'Опиши своїми словами, що відбувається в першій анімації і чим вона закінчується (останній кадр/стан)?' },
      { id: '0.2', q: 'Звідки людина приходить на цей екран (QR? телеграм? від друга?) і що вона вже знає в момент входу?' },
      { id: '0.3', q: 'Що людина має відчути в перші 5 секунд?', hint: 'одне слово: цікавість / свій вайб / інтрига / драйв…' },
    ],
  },
  {
    t: '1 · Перший крок ПІСЛЯ анімації',
    note: 'Головна розв’язка якорів: будуємо лише наступний крок, не всю структуру.',
    qs: [
      { id: '1.1', q: 'Анімація пройшла. Що з’являється наступним?', hint: 'кадр місця? персонаж? питання до глядача? текст? нічого з цього?' },
      { id: '1.2', q: 'Яку ОДНУ річ людина має зрозуміти з цього першого кроку?' },
      { id: '1.3', q: 'Перший тап людини — це що?', hint: 'відповідь на питання? «далі»? тап по об’єкту? вибір?' },
    ],
  },
  {
    t: '2 · Оповідач і герой',
    qs: [
      { id: '2.1', q: 'Чи потрібен взагалі персонаж-оповідач? Якщо так — хто він?', hint: 'Ярема? хтось інший? кілька? річ/предмет? голос без тіла?' },
      { id: '2.2', q: 'Хто ГЕРОЙ цієї історії: оповідач чи глядач?', hint: 'історія про «нього» чи про «тебе»?' },
      { id: '2.3', q: 'Як оповідач ставиться до глядача?', hint: 'друг? новачок? рівний суперник? гість?' },
    ],
  },
  {
    t: '3 · Світ і якорі',
    qs: [
      { id: '3.1', q: 'Де відбувається історія? Важливо, щоб це було впізнаване реальне місце — чи умовний світ?' },
      { id: '3.2', q: 'Назви 3-5 сутностей, які ТОЧНО існують у цьому світі (не обговорюється). Решта — змінне.' },
      { id: '3.3', q: 'Що з реального місця/людей мусить потрапити в історію (фішки, деталі, локальні приколи)?' },
    ],
  },
  {
    t: '4 · Що доносимо',
    qs: [
      { id: '4.1', q: 'Людина закрила онбординг. Рівно 3 факти, які вона мусить запам’ятати:' },
      { id: '4.2', q: 'І одне ВІДЧУТТЯ, яке має лишитись:' },
      { id: '4.3', q: 'Що ми свідомо НЕ кажемо (на потім / на місці дізнається)?' },
    ],
  },
  {
    t: '5 · Шлях степ-бай-степ',
    note: 'Продовж ланцюжок: [анімація-інтро] → крок 1 → крок 2 → … → [реєстрація]',
    qs: [
      { id: '5.1', q: 'Випиши кроки (грубо: «показуємо X», «питаємо Y», «даємо пограти в Z»):' },
      { id: '5.2', q: 'Де людина взаємодіє (тапає/грає), а де просто дивиться?' },
      { id: '5.3', q: 'Де паузи-дихання без тексту (анімації, череда кадрів)?' },
      { id: '5.4', q: 'Після якого кроку людина «готова» тиснути реєстрацію — і що її підштовхує?' },
    ],
  },
  {
    t: '6 · Тон і голос',
    qs: [
      { id: '6.1', q: 'Напиши 3-5 фраз, які оповідач МІГ би сказати (своїми словами — це стане еталоном тону):' },
      { id: '6.2', q: '1-2 фрази/стилі, які він НІКОЛИ не скаже:' },
      { id: '6.3', q: 'Референс гумору/подачі («щоб було як у …»):' },
    ],
  },
  {
    t: '7 · Продакшн-рамки',
    qs: [
      { id: '7.1', q: 'Скільки триває весь онбординг для людини, що не залипає?' },
      { id: '7.2', q: 'Скільки тапів/взаємодій — ок, а скільки — «задовбали»?' },
      { id: '7.3', q: 'Звук: потрібен? (друк, музика, звуки двору?)' },
      { id: '7.4', q: 'Якщо завтра дедлайн і треба різати третину — що ріжемо першим?' },
      { id: '7.5', q: '«Готово до продакшну» = чек-лист із 3 пунктів:' },
    ],
  },
];

const LS_KEY = 'dbc_brief_answers_v1';

export default function BriefPage() {
  const [a, setA] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState('');
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setA(JSON.parse(raw)); } catch { /* ok */ }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch { /* ok */ } }, 400);
    return () => clearTimeout(t);
  }, [a]);

  const done = useMemo(() => Object.values(a).filter((v) => v.trim().length > 2).length, [a]);
  const total = SECS.reduce((s, x) => s + x.qs.length, 0);

  const md = useMemo(() => {
    const lines = ['# БРИФ — відповіді (онбординг DBC)', '', `_Заповнено: ${done}/${total}_`, ''];
    for (const sec of SECS) {
      lines.push(`## Секція ${sec.t}`, '');
      for (const q of sec.qs) {
        lines.push(`**${q.id} · ${q.q}**`, '', a[q.id]?.trim() || '_—_', '');
      }
    }
    return lines.join('\n');
  }, [a, done, total]);

  async function saveToProject() {
    setSaved('…');
    try {
      const r = await fetch('/api/brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ md }) });
      const d = await r.json();
      setSaved(d.ok ? '✅ Збережено у STORYBOARD/projects/pingpong/BRIEF_ANSWERS.md' : '⚠️ ' + d.error);
    } catch { setSaved('⚠️ Не вийшло — скачай .md'); }
  }
  function downloadMd() {
    const blob = new Blob([md], { type: 'text/markdown' });
    const u = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = u; el.download = 'BRIEF_ANSWERS.md'; el.click();
    URL.revokeObjectURL(u);
  }

  const st = {
    wrap: { maxWidth: 760, margin: '0 auto', padding: '28px 18px 80px', fontFamily: "'Onest', system-ui, sans-serif", color: '#16110d' } as React.CSSProperties,
    h1: { fontFamily: "'Unbounded', sans-serif", fontWeight: 900, fontSize: 24, textTransform: 'uppercase' as const, margin: '0 0 6px' },
    sub: { color: '#5b5148', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 },
    sec: { background: '#fff', border: '3px solid #16110d', borderRadius: 16, boxShadow: '4px 4px 0 #16110d', padding: '16px 16px 8px', margin: '0 0 16px' },
    secT: { fontFamily: "'Unbounded', sans-serif", fontWeight: 800, fontSize: 15, margin: '0 0 4px' },
    note: { fontSize: 12.5, color: '#5b5148', margin: '0 0 10px' },
    q: { fontWeight: 700, fontSize: 14.5, margin: '12px 0 4px', lineHeight: 1.4 },
    hint: { fontSize: 12, color: '#8a7f72', margin: '0 0 6px' },
    ta: { width: '100%', minHeight: 74, font: 'inherit', fontSize: 15, padding: '10px 12px', border: '2.5px solid #16110d', borderRadius: 10, background: '#fffdf6', resize: 'vertical' as const, boxSizing: 'border-box' as const },
    bar: { position: 'fixed' as const, left: 0, right: 0, bottom: 0, background: '#16110d', padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const, zIndex: 50 },
    btn: { font: "800 13px 'Unbounded', sans-serif", textTransform: 'uppercase' as const, background: '#ffc619', color: '#16110d', border: '3px solid #fff8ec', borderRadius: 12, padding: '12px 18px', cursor: 'pointer' },
    btn2: { font: "800 13px 'Unbounded', sans-serif", textTransform: 'uppercase' as const, background: 'transparent', color: '#fff8ec', border: '3px solid #fff8ec', borderRadius: 12, padding: '12px 18px', cursor: 'pointer' },
    prog: { color: '#fff8ec', fontSize: 13, fontWeight: 700 },
  };

  return (
    <main style={{ background: '#fbf1dd', minHeight: '100svh' }}>
      <div style={st.wrap}>
        <h1 style={st.h1}>Бриф · онбординг</h1>
        <p style={st.sub}>Відповідай своїми словами. «Не знаю» і «байдуже» — теж відповіді (знімають якір).
          Все автозберігається в браузері; в кінці — «Зберегти у проєкт».</p>
        {SECS.map((sec) => (
          <section key={sec.t} style={st.sec}>
            <h2 style={st.secT}>Секція {sec.t}</h2>
            {sec.note && <p style={st.note}>{sec.note}</p>}
            {sec.qs.map((q) => (
              <div key={q.id} style={{ marginBottom: 10 }}>
                <div style={st.q}>{q.id} · {q.q}</div>
                {q.hint && <div style={st.hint}>{q.hint}</div>}
                <textarea style={st.ta} value={a[q.id] ?? ''} placeholder="…"
                  onChange={(e) => setA((p) => ({ ...p, [q.id]: e.target.value }))} />
              </div>
            ))}
          </section>
        ))}
        <div style={{ height: 30 }} />
      </div>
      <div style={st.bar}>
        <span style={st.prog}>{done}/{total}</span>
        <button style={st.btn} onClick={saveToProject}>Зберегти у проєкт</button>
        <button style={st.btn2} onClick={downloadMd}>Скачати .md</button>
        {saved && <span style={{ ...st.prog, width: '100%', textAlign: 'center' as const }}>{saved}</span>}
      </div>
    </main>
  );
}

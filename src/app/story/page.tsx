'use client';

import { useEffect, useState } from 'react';

/**
 * ПІСОЧНИЦЯ ІСТОРІЇ (/story) — клеїмо онбординг по одному кадру.
 * Кожен крок = кілька варіацій з живим прев'ю; вибір фіксується у
 * STORYBOARD/projects/pingpong/story_choices.json (локально). Наступний крок
 * генерує Клод після фіксації попереднього.
 */

type Variant = {
  id: string; label: string; desc: string;
  imgs: string[]; mode: 'kenout' | 'fade' | 'flip';
};
type Step = { id: number; title: string; note?: string; variants: Variant[] };

/* Крок 1 — з брифа: після інтро йде ГЛИБОКИЙ ZOOM-IN; мета — ВАУ + інтрига;
   можливо взагалі без тапу. Три класичні кіновідкриття: */
const STEPS: Step[] = [
  {
    id: 1,
    title: 'Куди виходить глибокий zoom-in після інтро?',
    note: 'Мета: ВАУ + інтрига в перші 5 секунд. Можливо без жодного тапу — сцена грає сама.',
    variants: [
      {
        id: 'A', label: 'Деталь-загадка', mode: 'kenout',
        desc: 'Зум виринає ВПРИТУЛ до дивної деталі (мʼяч у траві) — не одразу ясно, що бачиш. Камера повільно відʼїжджає, світ збирається довкола деталі.',
        imgs: ['/onb/v3/bg-find.jpg'],
      },
      {
        id: 'B', label: 'Місце оживає', mode: 'fade',
        desc: 'Зум виходить у широкий кадр двору — і місце «прокидається»: день перетікає в ніч із гірляндами й назад. Час тече на очах, жодного тексту.',
        imgs: ['/onb/v3/bg-front.jpg', '/onb/v3/bg-night.jpg'],
      },
      {
        id: 'C', label: 'Гра вже йде', mode: 'flip',
        desc: 'Зум вискакує в сцену, де ралі ВЖЕ триває: мʼяч літає через стіл туди-сюди. Історія починається посеред дії — in medias res.',
        imgs: ['/onb/v3/bg-rally-a.jpg', '/onb/v3/bg-rally-b.jpg'],
      },
    ],
  },
];

function Preview({ v }: { v: Variant }) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (v.imgs.length < 2) return;
    const t = setInterval(() => setF((x) => x + 1), v.mode === 'flip' ? 450 : 1800);
    return () => clearInterval(t);
  }, [v]);
  const cur = v.imgs[f % v.imgs.length];
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '9/14', overflow: 'hidden', borderRadius: 10, background: '#16110d' }}>
      {v.imgs.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          opacity: src === cur ? 1 : 0,
          transition: v.mode === 'fade' ? 'opacity 1.1s ease' : 'none',
          animation: v.mode === 'kenout' ? 'stKen 6s ease-out infinite' : undefined,
        }} />
      ))}
      <style>{`@keyframes stKen { 0% { transform: scale(1.7); } 60% { transform: scale(1); } 100% { transform: scale(1); } }`}</style>
    </div>
  );
}

export default function StorySandbox() {
  const [choices, setChoices] = useState<Record<string, { choice: string }>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/story').then((r) => r.json()).then((d) => setChoices(d.choices ?? {})).catch(() => {});
  }, []);

  const step = STEPS.find((s) => !choices[String(s.id)]) ?? null;
  const fixed = STEPS.filter((s) => choices[String(s.id)]);

  async function glue() {
    if (!step || !sel) return;
    setMsg('…');
    try {
      const r = await fetch('/api/story', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ step: step.id, choice: sel, comment }),
      });
      const d = await r.json();
      if (d.ok) {
        setChoices((c) => ({ ...c, [String(step.id)]: { choice: sel } }));
        setMsg('✅ Приклеєно! Скажи Клоду — він згенерує наступний крок.');
        setSel(null); setComment('');
      } else { setMsg('⚠️ Тут запис недоступний — просто скажи Клоду: «крок ' + step.id + ' — варіант ' + sel + '»'); }
    } catch { setMsg('⚠️ Скажи Клоду вибір словами: «крок ' + step.id + ' — ' + sel + '»'); }
  }

  const S = {
    wrap: { maxWidth: 900, margin: '0 auto', padding: '26px 16px 60px', fontFamily: "'Onest', system-ui, sans-serif", color: '#16110d' } as React.CSSProperties,
    h1: { fontFamily: "'Unbounded', sans-serif", fontWeight: 900 as const, fontSize: 22, textTransform: 'uppercase' as const, margin: '0 0 4px' },
    sub: { color: '#5b5148', fontSize: 13.5, margin: '0 0 18px' },
    strip: { display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' as const },
    chip: { fontFamily: "'Unbounded', sans-serif", fontWeight: 800 as const, fontSize: 11, background: '#a6e22e', border: '3px solid #16110d', borderRadius: 10, padding: '8px 12px' },
    stepT: { fontFamily: "'Unbounded', sans-serif", fontWeight: 800 as const, fontSize: 16, margin: '0 0 4px' },
    note: { fontSize: 13, color: '#5b5148', margin: '0 0 14px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 },
    card: (on: boolean) => ({
      background: '#fff', border: on ? '4px solid #ff2e88' : '3px solid #16110d', borderRadius: 16,
      boxShadow: on ? '5px 5px 0 #ff2e88' : '4px 4px 0 #16110d', padding: 10, cursor: 'pointer',
      transform: on ? 'translateY(-3px)' : 'none', transition: 'all .15s ease',
    } as React.CSSProperties),
    vl: { fontFamily: "'Unbounded', sans-serif", fontWeight: 800 as const, fontSize: 13.5, margin: '10px 0 4px' },
    vd: { fontSize: 12.5, color: '#5b5148', lineHeight: 1.45 },
    ta: { width: '100%', minHeight: 56, font: 'inherit', fontSize: 14, padding: '10px 12px', border: '2.5px solid #16110d', borderRadius: 10, background: '#fffdf6', marginTop: 14, boxSizing: 'border-box' as const },
    glue: { font: "800 14px 'Unbounded', sans-serif", textTransform: 'uppercase' as const, background: '#ff2e88', color: '#fff', border: '3px solid #16110d', borderRadius: 14, boxShadow: '4px 4px 0 #16110d', padding: '14px 22px', cursor: 'pointer', marginTop: 12, width: '100%' },
  };

  return (
    <main style={{ background: '#fbf1dd', minHeight: '100svh' }}>
      <div style={S.wrap}>
        <h1 style={S.h1}>Пісочниця історії</h1>
        <p style={S.sub}>Клеїмо онбординг по одному кадру. Обери варіацію → «Клеїмо» → Клод генерує наступний крок.</p>
        {fixed.length > 0 && (
          <div style={S.strip}>
            {fixed.map((s) => <span key={s.id} style={S.chip}>✓ Крок {s.id}: {choices[String(s.id)].choice}</span>)}
          </div>
        )}
        {step ? (
          <>
            <h2 style={S.stepT}>Крок {step.id} · {step.title}</h2>
            {step.note && <p style={S.note}>{step.note}</p>}
            <div style={S.grid}>
              {step.variants.map((v) => (
                <div key={v.id} style={S.card(sel === v.id)} onClick={() => setSel(v.id)}>
                  <Preview v={v} />
                  <div style={S.vl}>{v.id} · {v.label}</div>
                  <div style={S.vd}>{v.desc}</div>
                </div>
              ))}
            </div>
            <textarea style={S.ta} placeholder="Коментар до вибору (необовʼязково): що підкрутити у вибраному…"
              value={comment} onChange={(e) => setComment(e.target.value)} />
            <button style={{ ...S.glue, opacity: sel ? 1 : 0.45 }} disabled={!sel} onClick={glue}>
              {sel ? 'Клеїмо варіант ' + sel + ' →' : 'Обери варіант'}
            </button>
            {msg && <p style={{ fontWeight: 700, marginTop: 10 }}>{msg}</p>}
          </>
        ) : (
          <p style={{ fontWeight: 700, fontSize: 15 }}>Всі поточні кроки приклеєні ✅ — скажи Клоду, він згенерує наступний.</p>
        )}
      </div>
    </main>
  );
}

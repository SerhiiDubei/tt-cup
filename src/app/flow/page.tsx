'use client';

import { useEffect, useRef, useState } from 'react';
import Prologue from '@/components/intro/Prologue';
import '../v2/v2.css';
import '../onb/onb.css';

/**
 * ЖИВА СКЛЕЙКА ФЛОУ (/flow) — режим творіння: Клод клеїть, юзер проживає.
 * v2: ОСНОВНА анімація (Prologue «Дощ») → тап → глибокий zoom-in →
 *     ТРИ ВАРІАНТИ виконання наступного шматка (перемикач A/B/C):
 *     A · деталь-загадка   B · місце оживає   C · гра вже йде
 */

let AC: AudioContext | null = null;
function blip() {
  try {
    AC = AC ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'square'; o.frequency.value = 640 + Math.random() * 220;
    g.gain.setValueAtTime(0.016, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.05);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.055);
  } catch { /* тиша */ }
}
function whoosh() {
  try {
    AC = AC ?? new AudioContext();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, AC.currentTime + 0.9);
    g.gain.setValueAtTime(0.06, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.95);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + 1);
  } catch { /* тиша */ }
}

type Vr = 'A' | 'B' | 'C';
const VARIANTS: Record<Vr, {
  name: string; line: string; holdMs: number;
}> = {
  A: { name: 'Деталь-загадка', holdMs: 2500, line: 'Бачиш мʼяч? Він тут не випадково.' },
  B: { name: 'Місце оживає', holdMs: 4200, line: 'Це місце живе своїм графіком. Скоро в ньому зʼявишся ти.' },
  C: { name: 'Гра вже йде', holdMs: 2600, line: 'Чуєш? Тут уже грають. Поки що — без тебе.' },
};

export default function FlowV2() {
  const [stage, setStage] = useState<'intro' | 'zoom' | 'reveal' | 'line' | 'end'>('intro');
  const [vr, setVr] = useState<Vr>('A');
  const [chars, setChars] = useState(0);
  const [dayNight, setDayNight] = useState(0); // варіант B
  const [rally, setRally] = useState(0);       // варіант C
  const [runKey, setRunKey] = useState(0);
  const revealRef = useRef<HTMLDivElement>(null);
  const V = VARIANTS[vr];

  useEffect(() => {
    if (stage === 'zoom') { whoosh(); const t = setTimeout(() => setStage('reveal'), 1050); return () => clearTimeout(t); }
    if (stage === 'reveal') {
      const el = revealRef.current;
      if (el) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go')));
      const t = setTimeout(() => setStage('line'), V.holdMs);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  /* B: час тече день→ніч→день; C: ралі-кадри */
  useEffect(() => {
    if (stage !== 'reveal' && stage !== 'line') return;
    if (vr === 'B') { const t = setInterval(() => setDayNight((x) => x + 1), 1600); return () => clearInterval(t); }
    if (vr === 'C') { const t = setInterval(() => setRally((x) => x + 1), 480); return () => clearInterval(t); }
  }, [stage, vr]);
  useEffect(() => {
    if (stage !== 'line') return;
    setChars(0);
    const t = setInterval(() => setChars((c) => {
      if (c >= V.line.length) { clearInterval(t); return c; }
      if (c % 3 === 0) blip();
      return c + 1;
    }), 30);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, vr]);

  const typed = V.line.slice(0, chars);
  const lineDone = chars >= V.line.length;
  const replay = (v: Vr) => { setVr(v); setChars(0); setDayNight(0); setRally(0); setStage('zoom'); };

  return (
    <main className="ob-root v30" key={runKey}><div className="ob-stage" style={{ background: '#16110d' }}>

      {(stage === 'intro' || stage === 'zoom') && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3, background: '#16110d',
          transition: 'transform 1.05s cubic-bezier(0.55, 0, 0.85, 0.4), filter 1s ease, opacity 1.05s ease',
          transform: stage === 'zoom' ? 'scale(14)' : 'none',
          filter: stage === 'zoom' ? 'blur(14px) brightness(3.2)' : 'none',
          opacity: stage === 'zoom' ? 0 : 1,
          transformOrigin: '50% 44%',
          pointerEvents: stage === 'zoom' ? 'none' : 'auto',
        }}>
          <Prologue onEnter={() => setStage('zoom')} sub="" hint="тапни" />
        </div>
      )}

      {(stage === 'reveal' || stage === 'line') && (
        <>
          {/* маленькі таби варіантів — переглянути виконання */}
          <div style={{ position: 'absolute', zIndex: 9, top: 'calc(12px + env(safe-area-inset-top))', right: 12, display: 'flex', gap: 6 }}>
            {(['A', 'B', 'C'] as Vr[]).map((v) => (
              <button key={v} onClick={() => replay(v)} style={{
                font: "800 12px 'Unbounded'", width: 34, height: 34, borderRadius: 10, cursor: 'pointer',
                border: '2.5px solid #16110d',
                background: v === vr ? '#ffc619' : 'rgba(251,241,221,0.85)',
              }}>{v}</button>
            ))}
          </div>

          <div ref={revealRef} className={'fl-reveal v-' + vr} style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
            {vr === 'A' && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="fl-a" src="/onb/v3/bg-find.jpg" alt="" />
            )}
            {vr === 'B' && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fl-b" src="/onb/v3/bg-front.jpg" alt="" style={{ opacity: dayNight % 2 === 0 ? 1 : 0 }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fl-b" src="/onb/v3/bg-night.jpg" alt="" style={{ opacity: dayNight % 2 === 1 ? 1 : 0 }} />
              </>
            )}
            {vr === 'C' && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fl-c" src="/onb/v3/bg-rally-a.jpg" alt="" style={{ opacity: rally % 2 === 0 ? 1 : 0 }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="fl-c" src="/onb/v3/bg-rally-b.jpg" alt="" style={{ opacity: rally % 2 === 1 ? 1 : 0 }} />
              </>
            )}
            <div className="fl-flash" />
            <style>{`
              .fl-reveal img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; image-rendering: pixelated; }
              .fl-reveal .fl-flash { position: absolute; inset: 0; background: #fff8ec; opacity: 1; }
              .fl-reveal.go .fl-flash { opacity: 0; transition: opacity 1.1s ease; }
              /* A: камера відʼїжджає від мʼяча */
              .fl-a { object-position: 50% 60%; transform: scale(2.7); transform-origin: 44% 82%; }
              .go .fl-a { transform: scale(1); transition: transform 4.6s cubic-bezier(0.16, 1, 0.3, 1); }
              /* B: широкий кадр, час тече крос-фейдом + ледь помітний наїзд */
              .fl-b { transition: opacity 1.5s ease; transform: scale(1.12); }
              .go .fl-b { transform: scale(1); transition: opacity 1.5s ease, transform 9s linear; }
              /* C: ралі одразу, без транзішнів між кадрами */
              .fl-c { transform: scale(1.06); }
              .go .fl-c { transform: scale(1); transition: transform 5s ease-out; }
            `}</style>
          </div>

          {stage === 'line' && (
            <div className="ob-vn" style={{ zIndex: 6 }}>
              <div className="v30-panel vgrow">
                <span className="v30-name">ЯРЕМА</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="v30-hero" src={vr === 'C' ? '/onb/v3/yar-2.png' : '/onb/v3/yar-1.png'} alt="" />
                {typed}
                {!lineDone && <span className="v30-cur" />}
              </div>
              {lineDone && (
                <button className="v30-btn v30-in" onClick={() => setStage('end')}>далі ▸</button>
              )}
            </div>
          )}
        </>
      )}

      {stage === 'end' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 8, display: 'grid', placeItems: 'center',
          background: '#16110d', color: '#fff8ec', textAlign: 'center', padding: 24,
        }}>
          <div style={{ maxWidth: 320 }}>
            <div style={{ fontFamily: 'Unbounded', fontWeight: 900, fontSize: 19, textTransform: 'uppercase', marginBottom: 8 }}>
              ⛳ Кінець склейки
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,248,236,0.75)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Ти щойно пройшов варіант <b style={{ color: '#ffc619' }}>{vr} · {V.name}</b>.
              Проживи всі три — і скажи, який лишаємо.
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {(['A', 'B', 'C'] as Vr[]).map((v) => (
                <button key={v} className="v30-btn" style={{ opacity: v === vr ? 0.55 : 1 }}
                  onClick={() => replay(v)}>
                  {v === vr ? '↻ ще раз ' : '▶ дивитись '} {v} · {VARIANTS[v].name}
                </button>
              ))}
              <button className="v30-btn dark" onClick={() => { setStage('intro'); setRunKey((k) => k + 1); }}>
                ↺ з самого початку (з інтро)
              </button>
            </div>
          </div>
        </div>
      )}
    </div></main>
  );
}

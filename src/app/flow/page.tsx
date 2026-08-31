'use client';

import { useEffect, useRef, useState } from 'react';
import Prologue from '@/components/intro/Prologue';
import '../v2/v2.css';
import '../onb/onb.css';

/**
 * ЖИВА СКЛЕЙКА ФЛОУ (/flow) — режим творіння.
 * v3: ОСНОВНА анімація (Prologue «Дощ») → докручений транзішен (двофазний
 * наїзд + bloom + розфокус-у-фокус) → ПЕРШИЙ КАДР: 5 «глибоких» варіантів
 * (мінімалізм, масштабний контраст). Вибір варіанта = рестарт З ІНТРО.
 */

let AC: AudioContext | null = null;
function whoosh() {
  try {
    AC = AC ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(200, AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(36, AC.currentTime + 1.15);
    g.gain.setValueAtTime(0.07, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 1.2);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + 1.25);
  } catch { /* тиша */ }
}

const DEEP = [
  { id: 1, name: 'Небо', img: '/onb/deep/deepx-1.jpg' },
  { id: 2, name: 'Двір згори', img: '/onb/deep/deepx-2.jpg' },
  { id: 3, name: 'Стіна', img: '/onb/deep/deepx-3.jpg' },
];

export default function FlowV3() {
  const [vr, setVr] = useState(1);
  const [stage, setStage] = useState<'intro' | 'zoom' | 'reveal' | 'end'>('intro');
  const [runKey, setRunKey] = useState(0);
  const [showNext, setShowNext] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const frame = DEEP[vr - 1];

  useEffect(() => {
    if (stage === 'zoom') { whoosh(); const t = setTimeout(() => setStage('reveal'), 1400); return () => clearTimeout(t); }
    if (stage === 'reveal') {
      setShowNext(false);
      const el = revealRef.current;
      if (el) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go')));
      const t = setTimeout(() => setShowNext(true), 2600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  /* вибір варіанта = ПОВНИЙ рестарт з інтро */
  const restartWith = (v: number) => { setVr(v); setShowNext(false); setStage('intro'); setRunKey((k) => k + 1); };

  return (
    <main className="ob-root v30"><div className="ob-stage" style={{ background: '#16110d' }} key={runKey}>

      {(stage === 'intro' || stage === 'zoom') && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 3, background: '#16110d',
          /* двофазний наїзд: мʼякий старт → різке прискорення */
          transition: 'transform 1.4s cubic-bezier(0.75, 0, 0.95, 0.4), filter 1.3s cubic-bezier(0.8, 0, 1, 1), opacity 1.4s ease',
          transform: stage === 'zoom' ? 'scale(19)' : 'none',
          filter: stage === 'zoom' ? 'blur(18px) brightness(3.6)' : 'none',
          opacity: stage === 'zoom' ? 0 : 1,
          transformOrigin: '50% 44%',
          pointerEvents: stage === 'zoom' ? 'none' : 'auto',
        }}>
          <Prologue onEnter={() => setStage('zoom')} sub="" hint="тапни" />
        </div>
      )}

      {(stage === 'reveal' || stage === 'end') && (
        <>
          {/* перемикач варіантів: рестарт з інтро */}
          <div style={{ position: 'absolute', zIndex: 9, top: 'calc(12px + env(safe-area-inset-top))', right: 12, display: 'flex', gap: 5 }}>
            {DEEP.map((d) => (
              <button key={d.id} onClick={() => restartWith(d.id)} style={{
                font: "800 12px 'Unbounded'", width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
                border: '2.5px solid #16110d',
                background: d.id === vr ? '#ffc619' : 'rgba(251,241,221,0.85)',
              }}>{d.id}</button>
            ))}
          </div>

          <div ref={revealRef} className="fl-reveal" style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frame.img} alt="" />
            <div className="fl-flash" />
            <style>{`
              .fl-reveal img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
                image-rendering: pixelated;
                transform: scale(0.55) translateY(5%); filter: blur(9px); opacity: 0.6; }
              /* НАСУВАННЯ: кадр прилітає з глибини з пружним овершутом,
                 далі живе повільним дрейфом */
              .fl-reveal.go img {
                animation:
                  flFly 1.5s cubic-bezier(0.22, 1.35, 0.36, 1) forwards,
                  flDrift 14s 1.5s ease-in-out infinite alternate;
                filter: blur(0); opacity: 1;
                transition: filter 0.9s ease, opacity 0.6s ease; }
              @keyframes flFly {
                from { transform: scale(0.55) translateY(5%); }
                to { transform: scale(1) translateY(0); } }
              @keyframes flDrift {
                from { transform: scale(1); }
                to { transform: scale(1.055) translateY(-1.2%); } }
              .fl-reveal .fl-flash { position: absolute; inset: 0; background: #fff8ec; opacity: 1; }
              .fl-reveal.go .fl-flash { opacity: 0; transition: opacity 1s ease; }
            `}</style>
          </div>

          {stage === 'reveal' && showNext && (
            <div style={{ position: 'absolute', zIndex: 6, left: 14, right: 14, bottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
              <button className="v30-btn v30-in" onClick={() => setStage('end')}>далі ▸</button>
            </div>
          )}

          {stage === 'end' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 8, display: 'grid', placeItems: 'center',
              background: 'rgba(22,17,13,0.9)', color: '#fff8ec', textAlign: 'center', padding: 22,
            }}>
              <div style={{ maxWidth: 330, width: '100%' }}>
                <div style={{ fontFamily: 'Unbounded', fontWeight: 900, fontSize: 18, textTransform: 'uppercase', marginBottom: 8 }}>
                  ⛳ Кінець склейки
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,248,236,0.75)', margin: '0 0 14px', lineHeight: 1.5 }}>
                  Ти пройшов старт <b style={{ color: '#ffc619' }}>{vr} · {frame.name}</b>.
                  Кожна кнопка нижче програє флоу З ПОЧАТКУ (інтро → транзішен → кадр).
                </p>
                <div style={{ display: 'grid', gap: 7 }}>
                  {DEEP.map((d) => (
                    <button key={d.id} className="v30-btn" style={{ opacity: d.id === vr ? 0.55 : 1, fontSize: 12 }}
                      onClick={() => restartWith(d.id)}>
                      {d.id === vr ? '↻' : '▶'} {d.id} · {d.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div></main>
  );
}

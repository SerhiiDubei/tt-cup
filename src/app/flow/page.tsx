'use client';

import { useEffect, useRef, useState } from 'react';
import Prologue from '@/components/intro/Prologue';
import BallDive from './BallDive';
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
  { id: 4, name: 'Двоє біля столу', img: '/onb/deep/deepx-4.jpg' },
];

const CAMS = [
  { id: 'follow' as const, name: 'V1 · камера тримає мʼяч' },
  { id: 'dolly' as const, name: 'V2 · рівний кіно-рух' },
];

/* 3 варіанти шрифту+моушену наративу (референс — «The Boat», SBS) */
const TXTS = [
  { id: 'log' as const, name: 'Т1 · журнал' },
  { id: 'hand' as const, name: 'Т2 · рукопис' },
  { id: 'deep' as const, name: 'Т3 · глибина' },
];

export default function FlowV3() {
  const [vr, setVr] = useState(1);
  const [cam, setCam] = useState<'follow' | 'dolly'>('follow');
  const [txt, setTxt] = useState<'log' | 'hand' | 'deep'>('log');
  const [stage, setStage] = useState<'intro' | 'zoom' | 'reveal' | 'dive' | 'end'>('intro');
  const [runKey, setRunKey] = useState(0);
  const [showNext, setShowNext] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const frame = DEEP[vr - 1];

  useEffect(() => {
    if (stage === 'zoom') { whoosh(); const t = setTimeout(() => setStage('dive'), 1400); return () => clearTimeout(t); }
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
  const restartCam = (c: 'follow' | 'dolly') => { setCam(c); setShowNext(false); setStage('intro'); setRunKey((k) => k + 1); };
  const restartTxt = (v: 'log' | 'hand' | 'deep') => { setTxt(v); setShowNext(false); setStage('intro'); setRunKey((k) => k + 1); };


  return (
    <main className="ob-root v30">
      {/* морські шрифти наративу (повна кирилиця) */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Neucha&family=Old+Standard+TT:ital@0;1&display=swap" />
      <div className="ob-stage" style={{ background: '#16110d' }} key={runKey}>

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

      {(stage === 'dive' || stage === 'end') && (
        <>
          {stage === 'dive' && (
            <>
              <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: '#0e4a66' }}>
                <BallDive key={cam + txt} mode={cam} variant={txt} onLinesDone={() => setShowNext(true)} />
              </div>
              {/* перемикачі варіацій: вибір = повний рестарт з інтро */}
              <div style={{ position: 'absolute', zIndex: 6, top: 'calc(10px + env(safe-area-inset-top))', right: 10, display: 'grid', gap: 5, justifyItems: 'end' }}>
                {CAMS.map((c) => (
                  <button key={c.id} onClick={() => restartCam(c.id)} style={{
                    fontFamily: 'Unbounded', fontWeight: 800, fontSize: 8.5, textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '6px 9px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: cam === c.id ? 'rgba(255,198,25,0.92)' : 'rgba(10,24,34,0.55)',
                    color: cam === c.id ? '#16110d' : 'rgba(255,248,236,0.85)',
                  }}>{c.name}</button>
                ))}
                <div style={{ height: 4 }} />
                {TXTS.map((v) => (
                  <button key={v.id} onClick={() => restartTxt(v.id)} style={{
                    fontFamily: 'Unbounded', fontWeight: 800, fontSize: 8.5, textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '6px 9px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: txt === v.id ? 'rgba(122,220,255,0.92)' : 'rgba(10,24,34,0.55)',
                    color: txt === v.id ? '#0b2230' : 'rgba(255,248,236,0.85)',
                  }}>{v.name}</button>
                ))}
              </div>
              {showNext && (
                <div style={{ position: 'absolute', zIndex: 6, left: 14, right: 14, bottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
                  <button className="v30-btn v30-in" onClick={() => setStage('end')}>далі ▸</button>
                </div>
              )}
            </>
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
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div></main>
  );
}

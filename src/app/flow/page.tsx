'use client';

import { useEffect, useRef, useState } from 'react';
import BallAssembly from '@/components/v2/BallAssembly';
import '../v2/v2.css';
import '../onb/onb.css';

/**
 * ЖИВА СКЛЕЙКА ФЛОУ (/flow) — режим творіння: Клод клеїть досвід, юзер проживає.
 * v1: [процедурна анімація TT CUP] → тап → [глибокий zoom-in у напис]
 *     → [з білого виринає деталь-загадка: камера відʼїжджає від мʼяча]
 *     → [2.5с тиші] → [перша репліка з друком] → маркер кінця склейки.
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

const LINE1 = 'Бачиш мʼяч? Він тут не випадково.';

export default function FlowV1() {
  const [stage, setStage] = useState<'intro' | 'zoom' | 'reveal' | 'line' | 'end'>('intro');
  const [chars, setChars] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const revealRef = useRef<HTMLDivElement>(null);

  /* zoom-in: 1.05с → reveal; reveal: камера відʼїжджає 4.5с, панель на 2.5с */
  useEffect(() => {
    if (stage === 'zoom') { whoosh(); const t = setTimeout(() => setStage('reveal'), 1050); return () => clearTimeout(t); }
    if (stage === 'reveal') {
      const el = revealRef.current;
      if (el) { requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go'))); }
      const t = setTimeout(() => setStage('line'), 2500);
      return () => clearTimeout(t);
    }
  }, [stage]);
  /* друк першої репліки */
  useEffect(() => {
    if (stage !== 'line') return;
    setChars(0);
    const t = setInterval(() => setChars((c) => {
      if (c >= LINE1.length) { clearInterval(t); return c; }
      if (c % 3 === 0) blip();
      return c + 1;
    }), 30);
    return () => clearInterval(t);
  }, [stage]);

  const typed = LINE1.slice(0, chars);
  const lineDone = chars >= LINE1.length;

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
          <BallAssembly onEnter={() => setStage('zoom')} sub="" hint="тапни" />
        </div>
      )}

      {(stage === 'reveal' || stage === 'line') && (
        <>
          <div ref={revealRef} className="fl-reveal" style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/onb/v3/bg-find.jpg" alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 60%',
              imageRendering: 'pixelated',
            }} />
            {/* білий спалах, що тане після зуму */}
            <div className="fl-flash" style={{ position: 'absolute', inset: 0, background: '#fff8ec' }} />
            <style>{`
              .fl-reveal img { transform: scale(2.7); transform-origin: 44% 82%; }
              .fl-reveal.go img { transform: scale(1); transition: transform 4.6s cubic-bezier(0.16, 1, 0.3, 1); }
              .fl-reveal .fl-flash { opacity: 1; }
              .fl-reveal.go .fl-flash { opacity: 0; transition: opacity 1.1s ease; }
            `}</style>
          </div>

          {stage === 'line' && (
            <div className="ob-vn" style={{ zIndex: 6 }}>
              <div className="v30-panel vgrow">
                <span className="v30-name">ЯРЕМА</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="v30-hero" src="/onb/v3/yar-1.png" alt="" />
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
          <div>
            <div style={{ fontFamily: 'Unbounded', fontWeight: 900, fontSize: 20, textTransform: 'uppercase', marginBottom: 10 }}>
              ⛳ Кінець склейки v1
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,248,236,0.75)', maxWidth: 300, margin: '0 auto 20px', lineHeight: 1.5 }}>
              Інтро → zoom-in → деталь-загадка → перша репліка.
              Пройди, наговори враження — і я клею наступний шматок.
            </p>
            <button className="v30-btn" style={{ maxWidth: 260, margin: '0 auto' }}
              onClick={() => { setStage('intro'); setChars(0); setRunKey((k) => k + 1); }}>
              ↻ пройти ще раз
            </button>
          </div>
        </div>
      )}
    </div></main>
  );
}

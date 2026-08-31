'use client';

import { useEffect, useRef, useState } from 'react';
import Prologue from '@/components/intro/Prologue';
import BallDive, { type NarrLine } from './BallDive';
import Transition from './Transition';
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

/* 5 варіантів акцентів на ключову інфу (шрифт: Press Start 2P) */
const ACCS = [
  { id: 'caps' as const, name: 'А1 · капс+масштаб' },
  { id: 'stamp' as const, name: 'А2 · жовтий удар' },
  { id: 'neon' as const, name: 'А3 · неон hotline' },
  { id: 'glitch' as const, name: 'А4 · глітч' },
  { id: 'invert' as const, name: 'А5 · плашка' },
];
type AccId = (typeof ACCS)[number]['id'];

/* наратив: внутрішня рефлексія про кінець літа — 3 настрої (tone of voice) */
const MOODS = [
  { id: 'bradbury' as const, name: 'Н1 · кульбабове (Бредбері)' },
  { id: 'murakami' as const, name: 'Н2 · тихе (Муракамі)' },
  { id: 'zhadan' as const, name: 'Н3 · дворове (Жадан)' },
];
type MoodId = (typeof MOODS)[number]['id'];

const MOOD_LINES: Record<MoodId, NarrLine[]> = {
  /* Н1: тепла ностальгія дитинства, сенсорні деталі — «Кульбабове вино» */
  bradbury: [
    { t: '~Літо закінчилось якось раптом.', d: 0 },
    { t: 'Ще вчора воно було всюди —', d: 2.6 },
    { t: '~на розпеченому асфальті,', d: 1.9 },
    { t: '~у липких пальцях від морозива,', d: 1.9 },
    { t: 'у вечорах, яким не було кінця.', d: 2.6 },
    { t: 'А сьогодні — *тихо*.', d: 3.2 },
    { t: '~Тільки десь у дворі', d: 2.8 },
    { t: 'ще стукає мʼячик об стіл.', d: 2.2 },
    { t: '!*Останній звук літа.*', d: 3.6 },
    { t: '!І я йду на нього.', d: 2.8 },
  ],
  /* Н2: рівна відсторонена меланхолія, проста точність — Муракамі */
  murakami: [
    { t: '~Літо пішло без попередження.', d: 0 },
    { t: 'Одного ранку повітря стало іншим.', d: 2.8 },
    { t: '~Я довго дивився у вікно.', d: 2.4 },
    { t: 'Куди дівається літо, коли закінчується?', d: 3.0 },
    { t: '~Можливо, воно опускається на дно.', d: 2.8 },
    { t: 'Разом з усім, що ми *не встигли*.', d: 2.6 },
    { t: '~Але на дні щось є.', d: 3.2 },
    { t: 'Щось чекає, поки я пірну.', d: 2.2 },
    { t: '!*Один мʼяч. Один стіл.*', d: 3.6 },
    { t: '!Останній матч літа.', d: 2.8 },
  ],
  /* Н3: українська дворова поетика, щем і теплота — Жадан */
  zhadan: [
    { t: '~Ось і все, літо.', d: 0 },
    { t: 'Ти пахло нагрітим бетоном і дощем.', d: 2.8 },
    { t: '~Ти було довше за наші плани.', d: 2.4 },
    { t: 'І коротше, ніж ми домовлялись.', d: 2.4 },
    { t: '~Двори порожніють, як кишені.', d: 3.0 },
    { t: 'Але щось лишається *завжди*.', d: 2.6 },
    { t: '~Білий мʼяч на дні вечора.', d: 3.0 },
    { t: 'Стіл, що памʼятає наші поразки.', d: 2.4 },
    { t: '!*Вересень. Останній сет.*', d: 3.6 },
    { t: '!Заходь — зіграємо.', d: 2.8 },
  ],
};

export default function FlowV3() {
  const [vr, setVr] = useState(1);
  const [cam, setCam] = useState<'follow' | 'dolly'>('follow');
  const [txt, setTxt] = useState<AccId>('caps');
  const [mood, setMood] = useState<MoodId>('bradbury');
  const [stage, setStage] = useState<'intro' | 'trans' | 'reveal' | 'dive' | 'end'>('intro');
  const [runKey, setRunKey] = useState(0);
  const [showNext, setShowNext] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const frame = DEEP[vr - 1];

  useEffect(() => {
    if (stage === 'trans') {
      whoosh();
      /* страховка: якщо gsap не дограв (прихована вкладка, фриз) — не застрягаємо */
      const t = setTimeout(() => setStage('dive'), 4400);
      return () => clearTimeout(t);
    }
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
  const restartTxt = (v: AccId) => { setTxt(v); setShowNext(false); setStage('intro'); setRunKey((k) => k + 1); };
  const restartMood = (v: MoodId) => { setMood(v); setShowNext(false); setStage('intro'); setRunKey((k) => k + 1); };


  return (
    <main className="ob-root v30">
      {/* шрифт наративу: Press Start 2P (повна кирилиця) */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" />
      <div className="ob-stage" style={{ background: '#16110d' }} key={runKey}>

      {stage === 'intro' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: '#16110d' }}>
          <Prologue onEnter={() => setStage('trans')} sub="" hint="тапни" />
        </div>
      )}

      {(stage === 'trans' || stage === 'dive' || stage === 'end') && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: '#0e4a66' }}>
            <BallDive key={cam + txt + mood} mode={cam} variant={txt} lines={MOOD_LINES[mood]} onLinesDone={() => setShowNext(true)} />
          </div>
          {stage === 'trans' && <Transition kind="wavec" onDone={() => setStage('dive')} />}
          {stage === 'dive' && (
            <>
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
                {ACCS.map((v) => (
                  <button key={v.id} onClick={() => restartTxt(v.id)} style={{
                    fontFamily: 'Unbounded', fontWeight: 800, fontSize: 8.5, textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '6px 9px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: txt === v.id ? 'rgba(122,220,255,0.92)' : 'rgba(10,24,34,0.55)',
                    color: txt === v.id ? '#0b2230' : 'rgba(255,248,236,0.85)',
                  }}>{v.name}</button>
                ))}
                <div style={{ height: 4 }} />
                {MOODS.map((v) => (
                  <button key={v.id} onClick={() => restartMood(v.id)} style={{
                    fontFamily: 'Unbounded', fontWeight: 800, fontSize: 8.5, textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '6px 9px', borderRadius: 3, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: mood === v.id ? 'rgba(255,140,102,0.92)' : 'rgba(10,24,34,0.55)',
                    color: mood === v.id ? '#2a130a' : 'rgba(255,248,236,0.85)',
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

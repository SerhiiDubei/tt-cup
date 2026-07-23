'use client';

import { useEffect, useRef, useState } from 'react';
import { useScrollState } from './Scroll';
import { toggleSound } from './sound';

/**
 * Фіксований UI історії: мʼячик-прогрес по верхній лінії,
 * кнопка звуку (Web Audio вмикається жестом), авто-скрол.
 */
export default function V3Ui() {
  const { y } = useScrollState();
  const [max, setMax] = useState(1);
  const [sound, setSound] = useState(false);
  const [auto, setAuto] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const measure = () => setMax(Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  // Авто-скрол: рівний темп; будь-який жест юзера вимикає
  useEffect(() => {
    if (!auto) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      window.scrollBy(0, dt * 0.11);
      if (window.scrollY >= max - 2) {
        setAuto(false);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    const stop = () => setAuto(false);
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, [auto, max]);

  const progress = Math.min(1, y / max);

  return (
    <>
      <div className="v3-progress" aria-hidden>
        <i className="v3-progress-ball" style={{ left: `calc(${progress * 100}% - ${progress * 22}px)` }} />
      </div>
      <div className="v3-ui">
        <button
          type="button"
          className={`v3-ui-btn ${sound ? 'on' : ''}`}
          aria-pressed={sound}
          aria-label={sound ? 'Вимкнути звук' : 'Увімкнути звук'}
          onClick={() => setSound(toggleSound())}
        >
          {sound ? '🔊' : '🔇'}
        </button>
        <button
          type="button"
          className={`v3-ui-btn ${auto ? 'on' : ''}`}
          aria-pressed={auto}
          aria-label={auto ? 'Зупинити авто-гортання' : 'Авто-гортання'}
          onClick={() => setAuto((a) => !a)}
        >
          {auto ? '⏸' : '▶'}
        </button>
      </div>
    </>
  );
}

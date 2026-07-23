'use client';

import { useState } from 'react';
import { IntroRain, IntroDrop, IntroRally } from './variants';

const VARIANTS = [
  { key: 'rain', name: '1 · Дощ ★', desc: 'обраний: кульки сідають у напис, кольорова хвиля фарбує їх кривою', Comp: IntroRain },
  { key: 'drop', name: '2 · Удар', desc: 'мʼяч падає зі сквошем, лускає — кульки дугами збирають напис', Comp: IntroDrop },
  { key: 'rally', name: '3 · Ралі', desc: 'дві ракетки перекидають мʼяч, кожен удар вибиває шматок напису', Comp: IntroRally },
] as const;

export default function IntroLab() {
  const [active, setActive] = useState(0);
  const [take, setTake] = useState(0); // ключ для перезапуску
  const V = VARIANTS[active];

  return (
    <div className="il-stage">
      <V.Comp key={`${V.key}-${take}`} />
      <div className="il-ui">
        {VARIANTS.map((v, i) => (
          <button
            key={v.key}
            type="button"
            className={`il-btn ${i === active ? 'on' : ''}`}
            onClick={() => {
              setActive(i);
              setTake((x) => x + 1);
            }}
          >
            {v.name}
          </button>
        ))}
        <button type="button" className="il-btn il-replay" onClick={() => setTake((x) => x + 1)} aria-label="Повторити">
          ↺
        </button>
      </div>
      <p className="il-desc">{V.desc} · тап по сцені = проскочити в кінець</p>
    </div>
  );
}

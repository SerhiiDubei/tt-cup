'use client';

import { useRef, useState } from 'react';
import { IntroRain } from './variants';

/**
 * Пролог онбордингу: обране інтро «Дощ» (DRUID BATTLE CUP) —
 * соло-мʼячик → каскад → відскоки → глітч-хвиля кольору.
 * Після збирання показує підпис і хінт; тап = далі (onEnter).
 */
export default function Prologue({
  onEnter,
  sub = 'турнір з настільного тенісу',
  hint = 'тапни — розкажу, що це за двіж',
}: {
  onEnter: () => void;
  sub?: string;
  hint?: string;
}) {
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  return (
    <div
      className="pl-stage"
      onPointerDown={() => {
        // перший тап скіпає анімацію (обробляє канвас), другий — вхід
        if (readyRef.current) onEnter();
      }}
    >
      <IntroRain
        onDone={() => {
          // невелика пауза, щоб тап-скіп не провалювався одразу у вхід
          setTimeout(() => {
            readyRef.current = true;
          }, 250);
          setReady(true);
        }}
      />
      <div className={`v2-intro-bottom ${ready ? 'show' : ''}`}>
        <p className="v2-intro-sub">{sub}</p>
        <p className="v2-intro-hint">{hint}</p>
      </div>
    </div>
  );
}

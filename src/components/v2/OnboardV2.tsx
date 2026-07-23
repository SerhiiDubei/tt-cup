'use client';

import { useState } from 'react';
import Prologue from '../intro/Prologue';
import Comic from './Comic';

/**
 * Вхідний флоу: QR → пролог DRUID BATTLE CUP (дощ мʼячиків з відскоками
 * і глітч-хвилею) → комікс-онбординг → CTA на реєстрацію.
 */
export default function OnboardV2() {
  const [phase, setPhase] = useState<'intro' | 'comic'>('intro');

  return (
    <div className="v2-stage-wrap">
      {phase === 'intro' ? <Prologue onEnter={() => setPhase('comic')} /> : <Comic />}
    </div>
  );
}

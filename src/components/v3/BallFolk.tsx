'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { BALLFOLK, type WalkStyle } from './folk';

/**
 * Мʼячик-чоловічок з характерною ходою. Кадрова анімація зі спрайт-листа;
 * phase зсуває стартовий кадр (щоб натовп не крокував синхронно),
 * hue перефарбовує кулю, cross=true жене його через сцену CSS-рухом.
 */
export function BallWalker({
  style: walkStyle = 'normal',
  hue = 0,
  size = 64,
  phase = 0,
  fps,
  flip = false,
  cross,
  pos,
}: {
  style?: WalkStyle;
  hue?: number;
  size?: number;
  /** 0..1 — частка циклу, з якої стартує */
  phase?: number;
  fps?: number;
  flip?: boolean;
  /** біжить через сцену: тривалість (с) і затримка (с) */
  cross?: { duration: number; delay?: number };
  pos?: CSSProperties;
}) {
  const sheet = BALLFOLK[walkStyle];
  const [frame, setFrame] = useState(sheet ? Math.floor(phase * sheet.frames) : 0);

  useEffect(() => {
    if (!sheet) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % sheet.frames), 1000 / (fps ?? sheet.fps));
    return () => clearInterval(id);
  }, [sheet, fps]);

  if (!sheet) return null;
  const col = frame % sheet.columns;
  const row = Math.floor(frame / sheet.columns);
  const rows = Math.ceil(sheet.frames / sheet.columns);
  const px = sheet.columns > 1 ? (col / (sheet.columns - 1)) * 100 : 0;
  const py = rows > 1 ? (row / (rows - 1)) * 100 : 0;

  const sprite = (
    <div
      className="bf-sprite"
      style={{
        width: size,
        aspectRatio: '1',
        backgroundImage: `url(${sheet.src})`,
        backgroundPosition: `${px}% ${py}%`,
        backgroundSize: `${sheet.columns * 100}% ${rows * 100}%`,
        backgroundRepeat: 'no-repeat',
        filter: hue ? `hue-rotate(${hue}deg)` : undefined,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
      aria-hidden
    />
  );

  if (cross) {
    return (
      <div
        className="bf-cross"
        style={{
          ...pos,
          animationDuration: `${cross.duration}s`,
          animationDelay: `${cross.delay ?? 0}s`,
        }}
      >
        {sprite}
      </div>
    );
  }
  return (
    <div className="bf-still" style={pos}>
      {sprite}
    </div>
  );
}

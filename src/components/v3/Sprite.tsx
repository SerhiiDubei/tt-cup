'use client';

import { useEffect, useState, type CSSProperties } from 'react';

export type Sheet = {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  columns: number;
  fps: number;
};

function frameStyle(sheet: Sheet, frame: number): CSSProperties {
  const col = frame % sheet.columns;
  const row = Math.floor(frame / sheet.columns);
  const rows = Math.ceil(sheet.frames / sheet.columns);
  const px = sheet.columns > 1 ? (col / (sheet.columns - 1)) * 100 : 0;
  const py = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return {
    aspectRatio: `${sheet.frameWidth} / ${sheet.frameHeight}`,
    backgroundImage: `url(${sheet.src})`,
    backgroundPosition: `${px}% ${py}%`,
    backgroundSize: `${sheet.columns * 100}% ${rows * 100}%`,
    backgroundRepeat: 'no-repeat',
  };
}

/** Кадр прокручується значенням 0..1 — скролом, а не часом. */
export function ScrubSprite({
  sheet, value, className = '', style,
}: {
  sheet: Sheet; value: number; className?: string; style?: CSSProperties;
}) {
  const frame = Math.min(sheet.frames - 1, Math.floor(value * sheet.frames));
  return <div className={className} style={{ ...style, ...frameStyle(sheet, frame) }} aria-hidden />;
}

/** Класична анімація за часом (для «говорить» тощо). */
export function FpsSprite({
  sheet, className = '', style, playing = true,
}: {
  sheet: Sheet; className?: string; style?: CSSProperties; playing?: boolean;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % sheet.frames), 1000 / sheet.fps);
    return () => clearInterval(id);
  }, [sheet, playing]);
  return <div className={className} style={{ ...style, ...frameStyle(sheet, frame) }} aria-hidden />;
}

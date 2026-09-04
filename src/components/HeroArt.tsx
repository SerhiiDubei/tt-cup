'use client';
import { useState } from 'react';
import BallAvatar from './BallAvatar';

/**
 * Аватар гравця. Якщо є готовий арт (`src`) — показуємо його; інакше
 * малюємо процедурний аватар-мʼячик (D-057) — детермінований від seed,
 * без мережі й без AI. Кольорова заглушка з літерою більше не потрібна.
 * `pending` лишено для сумісності — генерації фото зараз нема.
 */
export default function HeroArt({
  src, alt, color, initial, size = 150, radius = 20, seed,
}: {
  src?: string; alt: string; color?: string; initial?: string;
  size?: number; radius?: number; pending?: boolean; seed?: string;
}) {
  const [err, setErr] = useState(false);
  const wrap: React.CSSProperties = { margin: '6px auto 14px', width: size, height: size };

  if (!src || err) {
    return (
      <div style={wrap}>
        <BallAvatar seed={seed || alt || initial || 'x'} size={size} radius={radius} />
      </div>
    );
  }
  return (
    <div style={{
      ...wrap, position: 'relative', border: '3px solid var(--line)', borderRadius: radius,
      overflow: 'hidden', background: color ?? 'var(--yellow)', display: 'grid', placeItems: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={size} height={size} onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  );
}

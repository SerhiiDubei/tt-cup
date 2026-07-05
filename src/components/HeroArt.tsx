'use client';
import { useState } from 'react';

/** Robust hero art: shows the image; on load error falls back to a colored box with the initial. */
export default function HeroArt({
  src, alt, color, initial, size = 150, radius = 20,
}: { src?: string; alt: string; color: string; initial: string; size?: number; radius?: number }) {
  const [err, setErr] = useState(false);
  const box: React.CSSProperties = {
    width: size, height: size, margin: '6px auto 14px', border: '3px solid var(--line)',
    borderRadius: radius, overflow: 'hidden', background: color, display: 'grid', placeItems: 'center',
  };
  if (!src || err) {
    return (
      <div style={box}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: size * 0.42, color: 'var(--ink)' }}>{initial}</span>
      </div>
    );
  }
  return (
    <div style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={size} height={size} onError={() => setErr(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  );
}

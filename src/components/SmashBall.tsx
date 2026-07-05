'use client';

/** A clickable tennis ball — floats, and "smashes" (pops) on click. */
export default function SmashBall({ style }: { style?: React.CSSProperties }) {
  return (
    <button
      aria-label="м'яч — натисни"
      className="ttball bounce"
      style={{ cursor: 'pointer', position: 'absolute', zIndex: 2, ...style }}
      onClick={(e) => {
        const el = e.currentTarget;
        el.classList.remove('smash'); void el.offsetWidth; el.classList.add('smash');
      }}
    />
  );
}

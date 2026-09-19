'use client';

/**
 * Процедурний аватар-мʼячик (D-057): SVG, малюється в браузері, нуль мережі
 * і нуль AI. Вигляд детермінований від id гравця — той самий гравець завжди
 * має той самий аватар. Варіативність: фон, колір мʼяча, кепка/пов'язка,
 * очі, рот, аксесуар. Генерацію фото прибрано (буде платною фічею).
 */

const BG = ['#ff2e88', '#00cfc1', '#ffc619', '#2d4bff', '#ff5a36', '#8a45ff', '#a6e22e'];
const BALL = ['#fff8ec', '#ffe08a', '#ffd166', '#f4f1e6'];
const CAP = ['#16110d', '#2d4bff', '#ff2e88', '#00cfc1', '#ff5a36', '#8a45ff'];
const INK = '#16110d';

/** Детермінований хеш рядка → 32-бітне ціле (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export default function BallAvatar({ seed, size = 150, radius = 20 }: { seed: string; size?: number; radius?: number }) {
  const h = hash(seed || 'x');
  const pick = <T,>(arr: T[], shift: number): T => arr[(h >> shift) % arr.length];

  const bg = pick(BG, 0);
  const ball = pick(BALL, 4);
  const cap = pick(CAP, 7);
  const eyes = (h >> 11) % 4;      // 0 звичайні · 1 підморгує · 2 щасливі · 3 рішучі
  const mouth = (h >> 14) % 3;     // 0 усмішка · 1 «о» · 2 усмішка з зубами
  const hasCap = ((h >> 17) % 4) !== 0;      // 75% у кепці
  const hasBand = !hasCap && ((h >> 19) % 2) === 0; // інакше іноді пов'язка
  const tilt = ((h >> 21) % 11) - 5;         // -5..5 градусів

  /* Кадрування (D-058): силует різних гравців має однакову «посадку».
     Кепка/пов'язка добудовують фігуру вгору, тому без компенсації одні
     аватари тиснулись до верхньої кромки, інші провисали вниз — у сітці
     це читалось як кривизна. Рахуємо ВЕРХ фігури з урахуванням обводки,
     центруємо по вертикалі й підтискаємо, якщо не влазить у поле 14..86. */
  const top = hasCap ? 8.25 : hasBand ? 7.5 : 22.25; // низ мʼяча завжди 85.75
  const BOTTOM = 85.75, FRAME = 72;
  const dy = 50 - (top + BOTTOM) / 2;               // зсув до центру кадру
  const k = Math.min(1, FRAME / (BOTTOM - top));    // тільки підтискаємо, не роздуваємо

  return (
    /* width/height у стилі — 100%: сцени (напр. кіоск) розтягують ОБГОРТКУ
       через --pick-art !important, а svg лишався у своєму size і притискався
       вліво — аватар з'їжджав з центру картки (D-058). viewBox масштабує сам. */
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="аватар"
      style={{ display: 'block', width: '100%', height: '100%', borderRadius: radius, border: `3px solid ${INK}`, background: bg }}>
      {/* м'яч */}
      <g transform={`translate(50 50) scale(${k.toFixed(4)}) translate(-50 -50) translate(0 ${dy.toFixed(2)}) rotate(${tilt} 50 54)`}>
        <circle cx="50" cy="54" r="30" fill={ball} stroke={INK} strokeWidth="3.5" />
        {/* шов м'яча */}
        <path d="M26 44 Q50 56 74 44" fill="none" stroke={INK} strokeWidth="2" opacity=".35" />

        {/* очі */}
        {eyes === 0 && (<>
          <circle cx="40" cy="52" r="4.2" fill={INK} /><circle cx="60" cy="52" r="4.2" fill={INK} />
        </>)}
        {eyes === 1 && (<>
          <path d="M35 52 Q40 47 45 52" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="60" cy="52" r="4.2" fill={INK} />
        </>)}
        {eyes === 2 && (<>
          <path d="M35 54 Q40 48 45 54" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M55 54 Q60 48 65 54" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        </>)}
        {eyes === 3 && (<>
          <circle cx="40" cy="53" r="4.2" fill={INK} /><circle cx="60" cy="53" r="4.2" fill={INK} />
          <path d="M34 45 L46 48 M66 45 L54 48" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>)}

        {/* рот */}
        {mouth === 0 && <path d="M42 64 Q50 71 58 64" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
        {mouth === 1 && <ellipse cx="50" cy="66" rx="5" ry="6" fill={INK} />}
        {mouth === 2 && (<>
          <path d="M40 63 Q50 73 60 63 Z" fill={INK} />
          <path d="M43 64 H57" stroke="#fff8ec" strokeWidth="2.4" />
        </>)}

        {/* кепка задом наперед / пов'язка */}
        {hasCap && (<>
          <path d="M22 38 A28 28 0 0 1 78 38 Z" fill={cap} stroke={INK} strokeWidth="3.5" />
          <rect x="20" y="34" width="18" height="7" rx="3" fill={cap} stroke={INK} strokeWidth="3" />
          <path d="M30 30 h40" stroke={INK} strokeWidth="2" opacity=".4" />
        </>)}
        {hasBand && (
          <path d="M22 40 A28 28 0 0 1 78 40" fill="none" stroke={cap} strokeWidth="9" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}

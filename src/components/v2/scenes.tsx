/**
 * Фонові ілюстрації панелей комікса — плоскі SVG-сцени в стилі
 * Memphis-нуар: товсті контури, великі форми, жодних градієнтів.
 * Кожна сцена малюється у viewBox 0 0 400 300 і тягнеться під панель.
 */

const INK = '#16110D';

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg className="v2-scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {children}
    </svg>
  );
}

/** Тенісний стіл збоку + лампа — кабінет Директора. */
export function SceneIntro() {
  return (
    <Svg>
      <circle cx="330" cy="60" r="34" fill="#FFF8EC" stroke={INK} strokeWidth="5" />
      <path d="M330 94 L330 130" stroke={INK} strokeWidth="5" />
      <rect x="40" y="190" width="240" height="14" rx="4" fill="#2D4BFF" stroke={INK} strokeWidth="5" />
      <path d="M70 204 L60 260 M250 204 L260 260" stroke={INK} strokeWidth="7" />
      <rect x="154" y="168" width="10" height="24" fill={INK} />
      <circle cx="220" cy="178" r="9" fill="#FF8A2A" stroke={INK} strokeWidth="4" />
    </Svg>
  );
}

/** Календар: два тижні ліги. */
export function SceneCalendar() {
  return (
    <Svg>
      <rect x="90" y="50" width="220" height="190" rx="14" fill="#FFF8EC" stroke={INK} strokeWidth="6" />
      <rect x="90" y="50" width="220" height="44" rx="14" fill="#FF2E88" stroke={INK} strokeWidth="6" />
      <path d="M130 40 V70 M270 40 V70" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      {[0, 1].map((row) =>
        [0, 1, 2, 3, 4, 5, 6].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={104 + col * 28}
            y={112 + row * 40}
            width="20"
            height="26"
            rx="4"
            fill={row === 1 && col === 6 ? '#FFC619' : 'none'}
            stroke={INK}
            strokeWidth="3"
          />
        ))
      )}
      <path d="M112 120 L136 146 M136 120 L112 146" stroke="#FF5A36" strokeWidth="4" />
      <path d="M140 120 L164 146 M164 120 L140 146" stroke="#FF5A36" strokeWidth="4" />
    </Svg>
  );
}

/** Грай будь-де: стіл надворі, дерево, озеро. */
export function SceneAnywhere() {
  return (
    <Svg>
      <circle cx="80" cy="70" r="38" fill="#FFC619" stroke={INK} strokeWidth="5" />
      <ellipse cx="300" cy="250" rx="130" ry="36" fill="#2D4BFF" stroke={INK} strokeWidth="5" />
      <circle cx="330" cy="120" r="30" fill="#A6E22E" stroke={INK} strokeWidth="5" />
      <path d="M330 150 L330 190" stroke={INK} strokeWidth="7" />
      <rect x="120" y="170" width="160" height="11" rx="4" fill="#00CFC1" stroke={INK} strokeWidth="5" />
      <path d="M140 181 L134 224 M260 181 L266 224" stroke={INK} strokeWidth="6" />
      <rect x="196" y="154" width="7" height="16" fill={INK} />
    </Svg>
  );
}

/** Телефон: рахунок + чесність (+1/+2/+3). */
export function SceneHonesty() {
  return (
    <Svg>
      <rect x="140" y="34" width="120" height="232" rx="18" fill="#FFF8EC" stroke={INK} strokeWidth="6" />
      <rect x="156" y="66" width="88" height="30" rx="8" fill="#A6E22E" stroke={INK} strokeWidth="4" />
      <text x="200" y="88" textAnchor="middle" fontSize="20" fontWeight="900" fill={INK} fontFamily="Unbounded, sans-serif">
        11:7
      </text>
      <rect x="156" y="110" width="88" height="30" rx="8" fill="#FFC619" stroke={INK} strokeWidth="4" />
      <text x="200" y="132" textAnchor="middle" fontSize="20" fontWeight="900" fill={INK} fontFamily="Unbounded, sans-serif">
        7:11
      </text>
      <circle cx="176" cy="182" r="14" fill="#00CFC1" stroke={INK} strokeWidth="4" />
      <circle cx="212" cy="182" r="14" fill="#FF8A2A" stroke={INK} strokeWidth="4" />
      <text x="200" y="236" textAnchor="middle" fontSize="17" fontWeight="800" fill={INK} fontFamily="Onest, sans-serif">
        +1 +2 +3
      </text>
    </Svg>
  );
}

/** Живий рейтинг: стовпчики. */
export function SceneRating() {
  return (
    <Svg>
      {[
        { x: 70, h: 150, c: '#FF2E88' },
        { x: 140, h: 190, c: '#FFC619' },
        { x: 210, h: 110, c: '#00CFC1' },
        { x: 280, h: 70, c: '#8A45FF' },
      ].map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={260 - b.h} width="50" height={b.h} rx="8" fill={b.c} stroke={INK} strokeWidth="5" />
          <circle cx={b.x + 25} cy={260 - b.h - 22} r="13" fill="#FFF8EC" stroke={INK} strokeWidth="4" />
        </g>
      ))}
      <path d="M40 260 H370" stroke={INK} strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}

/** День Х: стіл, сонце, прапорці. */
export function SceneDayX() {
  return (
    <Svg>
      <circle cx="200" cy="66" r="40" fill="#FF8A2A" stroke={INK} strokeWidth="5" />
      <path d="M30 30 L86 44 L38 72 Z" fill="#FF2E88" stroke={INK} strokeWidth="4" />
      <path d="M370 40 L320 56 L364 84 Z" fill="#00CFC1" stroke={INK} strokeWidth="4" />
      <rect x="90" y="176" width="220" height="13" rx="4" fill="#2D4BFF" stroke={INK} strokeWidth="5" />
      <path d="M116 189 L106 246 M284 189 L294 246" stroke={INK} strokeWidth="7" />
      <rect x="194" y="158" width="9" height="20" fill={INK} />
      <circle cx="150" cy="164" r="8" fill="#FFF8EC" stroke={INK} strokeWidth="4" />
      <circle cx="252" cy="168" r="8" fill="#FF8A2A" stroke={INK} strokeWidth="4" />
    </Svg>
  );
}

/** Міні-ігри: мішень і черга мʼячиків. */
export function SceneMiniGames() {
  return (
    <Svg>
      <circle cx="200" cy="130" r="80" fill="#FFF8EC" stroke={INK} strokeWidth="6" />
      <circle cx="200" cy="130" r="52" fill="#FF5A36" stroke={INK} strokeWidth="5" />
      <circle cx="200" cy="130" r="24" fill="#FFC619" stroke={INK} strokeWidth="5" />
      {[60, 120, 180, 240, 300].map((x, i) => (
        <circle key={x} cx={x} cy={252} r={i % 2 ? 10 : 12} fill={i % 2 ? '#FF8A2A' : '#FFF8EC'} stroke={INK} strokeWidth="4" />
      ))}
      <text x="200" y="138" textAnchor="middle" fontSize="24" fontWeight="900" fill={INK} fontFamily="Unbounded, sans-serif">
        70
      </text>
    </Svg>
  );
}

/** Призи: три кубки — теніс / міні-ігри / комбо. */
export function ScenePrizes() {
  return (
    <Svg>
      {[
        { x: 90, c: '#FFC619', s: 1 },
        { x: 200, c: '#FF2E88', s: 1.25 },
        { x: 310, c: '#00CFC1', s: 1 },
      ].map((t) => (
        <g key={t.x} transform={`translate(${t.x} 150) scale(${t.s})`}>
          <path d="M-34 -50 H34 V-14 A34 34 0 0 1 -34 -14 Z" fill={t.c} stroke={INK} strokeWidth="5" />
          <path d="M-34 -42 C-58 -40 -58 -12 -34 -18 M34 -42 C58 -40 58 -12 34 -18" fill="none" stroke={INK} strokeWidth="5" />
          <rect x="-9" y="18" width="18" height="22" fill={t.c} stroke={INK} strokeWidth="5" />
          <rect x="-26" y="40" width="52" height="14" rx="4" fill={INK} />
        </g>
      ))}
    </Svg>
  );
}

/** Фінал: конфеті. */
export function SceneFinale() {
  return (
    <Svg>
      {[
        [40, 40, '#FF2E88'], [110, 90, '#00CFC1'], [70, 170, '#8A45FF'], [150, 30, '#FF8A2A'],
        [250, 50, '#A6E22E'], [320, 100, '#FF2E88'], [360, 40, '#FFC619'], [300, 190, '#00CFC1'],
        [200, 120, '#FFC619'], [120, 240, '#FF8A2A'], [280, 250, '#8A45FF'], [350, 240, '#FF5A36'],
        [170, 60, '#00CFC1'], [230, 40, '#FF2E88'], [175, 190, '#A6E22E'], [260, 150, '#FF8A2A'],
        [140, 130, '#8A45FF'], [240, 220, '#FFC619'],
      ].map(([x, y, c], i) =>
        i % 3 === 0 ? (
          <circle key={i} cx={x as number} cy={y as number} r="11" fill={c as string} stroke={INK} strokeWidth="4" />
        ) : i % 3 === 1 ? (
          <rect key={i} x={(x as number) - 9} y={(y as number) - 9} width="18" height="18" rx="3" fill={c as string} stroke={INK} strokeWidth="4" transform={`rotate(${(i * 37) % 360} ${x} ${y})`} />
        ) : (
          <path key={i} d={`M${x} ${(y as number) - 12} L${(x as number) + 12} ${(y as number) + 10} L${(x as number) - 12} ${(y as number) + 10} Z`} fill={c as string} stroke={INK} strokeWidth="4" />
        )
      )}
    </Svg>
  );
}

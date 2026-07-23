import type { Metadata } from 'next';
import '../v2.css';

export const metadata: Metadata = {
  title: 'Кастинг героя — TT CUP',
  description: 'Обери, хто розповідатиме про турнір.',
};

const CAST = [
  { n: 1, src: '/v2/cast/cast1.png', name: 'Легенда клубу', note: 'бабуся з короною і золотим ланцюгом — не програла жодного сету з 1987-го' },
  { n: 2, src: '/v2/cast/cast2.png', name: 'Шалений коуч', note: 'бандана, свисток, енергія на всіх 9 панелей' },
  { n: 3, src: '/v2/cast/cast3.png', name: 'Єнот-маскот', note: 'нахабний, ракетка на плечі, вайб мультика' },
  { n: 4, src: '/v2/cast/cast4.png', name: 'Промоутер', note: '⚠️ згенерувався з великою ракеткою — реквізит перероблю, якщо береш' },
  { n: 0, src: '/v2/director.png', name: 'Директор (як був)', note: 'пальто, суворість, нуар' },
];

export default function CastPage() {
  return (
    <main className="v2-cast">
      <h1>Кастинг героя</h1>
      <p className="v2-cast-sub">Хто веде онбординг? Скажи номер — далі згенерую йому пози й емоції під кожну панель.</p>
      <div className="v2-cast-grid">
        {CAST.map((c) => (
          <figure key={c.n} className="v2-cast-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.src} alt={c.name} loading="lazy" />
            <figcaption>
              <span className="v2-cast-n">{c.n}</span>
              <strong>{c.name}</strong>
              <small>{c.note}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

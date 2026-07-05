import HeroCard from '@/components/HeroCard';
import type { Player } from '@/lib/tournament/types';

export default function BuilderTeaser({ players }: { players: Player[] }) {
  const withArt = players.filter((p) => p.hero?.art).slice(0, 3);
  return (
    <section>
      <div className="wrap">
        <span className="eyebrow alt reveal">твій герой</span>
        <h2 className="title reveal">Не просто гравець — <span className="swirl">персонаж</span></h2>
        <p className="lead reveal d1" style={{ marginBottom: 30 }}>
          Обери стать, зачіску, колір волосся, форму й аксесуар — AI намалює твого героя в нашому стилі. Він стане твоєю карткою на весь турнір.
        </p>
        {withArt.length > 0 && (
          <div className="grid-auto reveal d1" style={{ marginBottom: 30 }}>
            {withArt.map((p, i) => (
              <div key={p.id} className={i % 2 ? 'tilt-r' : 'tilt-l'} style={{ justifySelf: 'center' }}>
                <HeroCard name={p.name} nickname={p.nickname} motto={p.motto} hero={p.hero} />
              </div>
            ))}
          </div>
        )}
        <a href="/register" className="btn pink reveal d2">🎨 Створити свого героя</a>
      </div>
    </section>
  );
}

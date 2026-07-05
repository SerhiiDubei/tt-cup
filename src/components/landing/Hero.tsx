import HeroCard from '@/components/HeroCard';
import SmashBall from '@/components/SmashBall';
import type { Tournament, Player } from '@/lib/tournament/types';

export default function Hero({ tournament, count, sample }: { tournament: Tournament; count: number; sample?: Player | null }) {
  const status = tournament?.status || 'registration';
  const cta =
    status === 'registration' ? { href: '/register', label: '✚ Створити героя' }
      : status === 'swiss' ? { href: '/schedule', label: '🏓 Мій матч' }
        : { href: '/bracket', label: '🏆 Плей-офф' };

  return (
    <section id="hero">
      <div className="deco circle" style={{ width: 120, height: 120, top: '14%', left: '6%', background: 'var(--yellow)' }} />
      <div className="deco" style={{ width: 70, height: 70, bottom: '16%', right: '10%', background: 'var(--cyan)', transform: 'rotate(12deg)' }} />
      <div className="deco tri" style={{ borderLeft: '34px solid transparent', borderRight: '34px solid transparent', borderBottom: '60px solid var(--pink)', top: '22%', right: '16%' }} />
      <div className="rally" style={{ bottom: '8%' }} aria-hidden="true"><span className="ttball" /></div>
      <SmashBall style={{ top: '16%', right: '8%' }} />
      <div className="wrap hero-grid">
        <div>
          <span className="hero-kicker"><span className="dot" /> настільний теніс · швейцарка + топ-8</span>
          <h1 className="reveal"><span className="pink">НАСТІЛЬНИЙ</span><br />ТЕНІС <span className="stroke">КУБОК</span></h1>
          <p className="hero-sub reveal d1">
            Створи свого <b>героя</b>, грай <b>швейцарку у 8 турів</b>, сам вписуй рахунок — і пробийся у <b>топ-8 офлайн плей-офф</b>.
          </p>
          <div className="hero-cta reveal d2">
            <a href={cta.href} className="btn pink">{cta.label}</a>
            <a href="/players" className="btn ghost">Учасники · {count}</a>
          </div>
        </div>
        <div className="reveal d2" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="tilt-r">
            {sample
              ? <HeroCard name={sample.name} nickname={sample.nickname} motto={sample.motto} hero={sample.hero} />
              : <HeroCard name="Олег" nickname="TOPSPIN_OLEG" motto="«ракетка — продовження руки»"
                  hero={{ color: '#FF2E88', shape: 'circle', style: 'attacker', emblem: '★' }} />}
          </div>
        </div>
      </div>
    </section>
  );
}

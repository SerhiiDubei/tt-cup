import type { Tournament } from '@/lib/tournament/types';

export default function Cta({ tournament }: { tournament: Tournament }) {
  const open = (tournament?.status || 'registration') === 'registration';
  return (
    <section>
      <div className="wrap">
        <div className="card reveal" style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--line)', textAlign: 'center', padding: 'clamp(40px,7vw,72px)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(30px,6vw,64px)', lineHeight: 0.95, letterSpacing: '-.03em' }}>
            {open ? <>Готовий крутити<br />топ-спін?</> : <>Турнір у розпалі!</>}
          </h2>
          <p style={{ maxWidth: 460, margin: '18px auto 28px', fontSize: 18, opacity: 0.9 }}>
            {open ? 'Створи героя, зіграй 8 турів і пробийся у топ-8.' : 'Дивись розклад, таблицю та сітку плей-офф.'}
          </p>
          <a href={open ? '#builder' : '/standings'} className="btn yellow" style={{ background: 'var(--yellow)' }}>
            {open ? '✚ Створити героя' : '📊 До таблиці'}
          </a>
        </div>
      </div>
    </section>
  );
}

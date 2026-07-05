import Link from 'next/link';
import { loadState } from '@/lib/state';
import RosterGrid from '@/components/app/RosterGrid';

export const dynamic = 'force-dynamic';

/**
 * /players — публічний ростер усіх зареєстрованих героїв.
 *
 * Server component: тягне снапшот через {@link loadState} і малює грід
 * {@link HeroCard}. Порожній стан (ще немає реєстрацій) показує CTA на
 * hero-білдер лендингу.
 */
export default async function PlayersPage() {
  const { tournament, players, matches } = await loadState();
  const count = players.length;
  const accepting = !tournament || tournament.status === 'registration';

  return (
    <main>
      <section>
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow">Ростер</span>
            <h2 className="title">Герої турніру</h2>
            <p className="lead">
              {count > 0
                ? `${count} ${count === 1 ? 'герой вийшов' : count < 5 ? 'герої вийшли' : 'героїв вийшло'} до столу. Обери суперника поглядом.`
                : 'Тут зʼявляться всі учасники, щойно хтось збере свого героя.'}
            </p>
          </div>

          {count === 0 ? (
            <div className="card reveal d1" style={{ marginTop: 36, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26, marginBottom: 10 }}>
                Ще порожньо 🏓
              </div>
              <p className="lead" style={{ margin: '0 auto 22px' }}>
                {accepting
                  ? 'Жоден герой ще не зареєструвався. Стань першим — збери свою картку у конструкторі.'
                  : 'Список учасників поки недоступний. Завітай трохи згодом.'}
              </p>
              {accepting && (
                <Link href="/register" className="btn pink">
                  Зібрати героя
                </Link>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 36 }}>
              <RosterGrid players={players} matches={matches} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

import { loadState } from '@/lib/state';
import StandingsTable from '@/components/app/StandingsTable';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  const { tournament, players, matches } = await loadState();

  const isRegistration = !tournament || tournament.status === 'registration';
  const hasPlayers = players.length > 0;

  return (
    <main>
      <section>
        <div className="wrap">
          <div className="reveal in">
            <span className="eyebrow">Турнірна таблиця</span>
            <h2 className="title">Хто в зеленій зоні</h2>
            <p className="lead">
              Швейцарська система: очки за перемоги, далі — Бухгольц і різниця партій.
              Топ-8 виходять у плей-офф.
            </p>
          </div>

          <div className="reveal d1 in" style={{ marginTop: 28 }}>
            {isRegistration ? (
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip live">Реєстрація триває</span>
                <p className="lead" style={{ margin: '14px auto 0' }}>
                  Таблиця зʼявиться після першого туру швейцарки.
                </p>
              </div>
            ) : !hasPlayers ? (
              <div className="card" style={{ textAlign: 'center' }}>
                <p className="lead" style={{ margin: '0 auto' }}>
                  Поки немає учасників.
                </p>
              </div>
            ) : (
              <StandingsTable
                players={players}
                matches={matches}
                qualify={tournament.status !== 'registration'}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

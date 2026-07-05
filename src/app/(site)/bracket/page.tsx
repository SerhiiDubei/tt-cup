import { loadState } from '@/lib/state';
import Bracket from '@/components/app/Bracket';

export const dynamic = 'force-dynamic';

/**
 * Плей-офф сітка (топ-8): QF → SF → ФІНАЛ + матч за 3-тє.
 * Серверний компонент: тягне снапшот через loadState(); поки немає
 * playoff-матчів — показуємо повідомлення, інакше рендеримо <Bracket />.
 */
export default async function BracketPage() {
  const { players, matches } = await loadState();
  const playoffMatches = matches.filter((m) => m.stage === 'playoff');
  const hasPlayoff = playoffMatches.length > 0;

  return (
    <main>
      <section>
        <div className="wrap">
          <div className="reveal">
            <span className="eyebrow alt">Сітка</span>
            <h2 className="title">Плей-офф · топ-8</h2>
            <p className="lead">
              Восьмеро найкращих швейцарки розігрують кубок: чвертьфінали, півфінали,
              фінал і матч за 3-тє місце.
            </p>
          </div>

          <div className="reveal d1" style={{ marginTop: 28 }}>
            {hasPlayoff ? (
              <Bracket players={players} matches={matches} />
            ) : (
              <div className="card" style={{ textAlign: 'center' }}>
                <span className="chip live" style={{ marginBottom: 14 }}>
                  Очікуємо
                </span>
                <p className="lead" style={{ margin: 0 }}>
                  Плей-офф почнеться після 8 турів.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

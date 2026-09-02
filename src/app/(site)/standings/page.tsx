import type { Metadata } from 'next';
import CtaSmart from '@/components/liga/CtaSmart';
import '../../liga.css';

export const metadata: Metadata = { title: 'Сітка — DRUID BATTLE CUP' };

/** Рейтинг ліги: порожній стан до жеребкування 6.09; далі — live 50/50. */
export default function StandingsPage() {
  return (
    <main className="jn-root insite"><div className="jn-wrap wide">
      <p className="jn-step">ліга · 7–12 вересня</p>
      <h1 className="jn-h1">Сітка і рейтинг</h1>
      <p className="jn-lead">
        Живий залік ліги: спортивні очки × 50% + фанові × 50%. Хто з ким зіграв,
        хто де стоїть — усе буде тут, онлайн.
      </p>

      <div className="jn-card jn-count">
        <p className="jn-count-label">Таблиця зʼявиться після жеребкування</p>
        <div className="jn-count-big">6 вересня 🎲</div>
        <p className="jn-hint" style={{ margin: 0 }}>
          Система розкине пари за рівнями → шість днів ліги → фінали Дня Х <b>13 вересня</b>.
        </p>
      </div>

      <div className="jn-card">
        <h3>Як рахуємо</h3>
        <p className="jn-hint" style={{ margin: 0 }}>
          Перемога — 3 очки, зіграна поразка — 1, незіграний матч — 0.
          Фанові бали приносять міні-ігри Дня Х. Тому в топ реально пробитись
          і середнячку — перевірено симуляцією.
        </p>
      </div>

      <CtaSmart />
    </div></main>
  );
}

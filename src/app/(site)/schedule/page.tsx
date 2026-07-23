import Link from 'next/link';
import type { Metadata } from 'next';
import '../../liga.css';

export const metadata: Metadata = { title: 'Розклад — DRUID BATTLE CUP' };

/** Розклад матчів ліги (D-038): порожній стан до жеребкування 2.08. */
export default function SchedulePage() {
  return (
    <main className="jn-root insite"><div className="jn-wrap wide">
      <p className="jn-step">ліга · 2–23 серпня</p>
      <h1 className="jn-h1">Розклад матчів</h1>
      <p className="jn-lead">
        Жорсткого розкладу нема — є 8 матчів і 21 день. Пишеш супернику в телеграм,
        домовляєтесь про час і граєте на ДРУЇДІ. Стіл один — тому дивись, коли вільно.
      </p>

      <div className="jn-card jn-count">
        <p className="jn-count-label">Пари зʼявляться після жеребкування</p>
        <div className="jn-count-big">2 серпня 🎲</div>
        <p className="jn-hint" style={{ margin: 0 }}>
          Кожен побачить своїх 8 суперників у кабінеті — з контактами й дедлайном <b>22.08, 23:59</b>.
        </p>
      </div>

      <div className="jn-card">
        <h3>Правила матчу</h3>
        <p className="jn-hint" style={{ margin: 0 }}>
          До 2 перемог у сетах, сет до 11 (від 10:10 — різниця 2). За взаємною згодою
          до матчу — один сет до 21. Рахунок вносите самі, суперник підтверджує.
        </p>
      </div>

      <Link className="jn-btn ghost" href="/pravyla">📜 Повні правила</Link>
    </div></main>
  );
}

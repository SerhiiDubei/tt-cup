'use client';

import { useState } from 'react';
import LigaNav from '@/components/liga/LigaNav';
import { LEVEL_LABEL } from '@/lib/liga';
import '../liga.css';

/**
 * 🧪 ПІСОЧНИЦЯ (D-040): подивитись UI/UX ліги З ДАНИМИ ще до реальних реєстрацій.
 * Додаєш фейкових гравців (+4 / +X / до 32) → «Жеребкування» → бачиш пари,
 * стартовий рейтинг і як виглядатиме кабінет гравця. НІЧОГО не пише в базу.
 * Пейринг — прототип бойового алгоритму C4: 8 суперників, близьких за рівнем.
 */

type SP = { id: number; nick: string; level: number };
type Match = { a: number; b: number };

const NICKS = [
  'TOPSPIN_OLEG', 'BETON_MASTER', 'KRUCHENA', 'DRUID_KID', 'SMASHKA', 'PINGVIN',
  'LOVETZ_SITKI', 'BACKHAND_B', 'RAKETA_IF', 'HALYNA_SPIN', 'NETTO', 'BRUKIVKA',
  'FORHEND_F', 'KASHTAN', 'PIDKRUTKA', 'STIL_ODYN', 'GIRLANDA', 'SERPEN_23',
  'BLOKER', 'TOP_SPINNER', 'MJACH_ZHYVY', 'LAVKA_PRO', 'PARKOVYI', 'EXPERT_TT',
  'ZHEREBOK', 'FANOVYK', 'SEREDNIACHOK', 'VAIB_ONLY', 'PINH_PONH', 'DVIZH_UA',
  'KUBOK_MRIY', 'OSTANNIY_SET',
];

function makePlayers(n: number, from: number): SP[] {
  return Array.from({ length: n }, (_, k) => {
    const i = from + k;
    const r = Math.random();
    const level = r < 0.2 ? 1 : r < 0.55 ? 2 : r < 0.85 ? 3 : 4;
    return { id: i, nick: NICKS[i % NICKS.length] + (i >= NICKS.length ? '_' + (Math.floor(i / NICKS.length) + 1) : ''), level };
  });
}

/** Прототип пейрингу: кожному 8 суперників, мінімальна різниця рівнів. */
function draw(players: SP[], perPlayer = 8): Match[] {
  const opps = new Map<number, Set<number>>(players.map((p) => [p.id, new Set()]));
  const matches: Match[] = [];
  const need = () => players.filter((p) => (opps.get(p.id)!.size < perPlayer));
  let guard = 0;
  while (need().length > 1 && guard++ < 5000) {
    const pool = need().sort((a, b) => opps.get(a.id)!.size - opps.get(b.id)!.size);
    const p = pool[0];
    const cand = pool
      .filter((q) => q.id !== p.id && !opps.get(p.id)!.has(q.id))
      .sort((a, b) =>
        Math.abs(a.level - p.level) - Math.abs(b.level - p.level) ||
        opps.get(a.id)!.size - opps.get(b.id)!.size ||
        Math.random() - 0.5);
    const q = cand[0];
    if (!q) { opps.get(p.id)!.add(-guard); continue; } // нікого — пропускаємо слот
    opps.get(p.id)!.add(q.id);
    opps.get(q.id)!.add(p.id);
    matches.push({ a: p.id, b: q.id });
  }
  return matches;
}

export default function SandboxPage() {
  const [players, setPlayers] = useState<SP[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [x, setX] = useState(8);

  const add = (n: number) => {
    setMatches(null);
    setPlayers((p) => [...p, ...makePlayers(Math.max(0, Math.min(64 - p.length, n)), p.length)]);
  };
  const byId = new Map(players.map((p) => [p.id, p]));
  const my = players[0];
  const myMatches = matches && my ? matches.filter((m) => m.a === my.id || m.b === my.id) : [];

  return (
    <main className="jn-root"><div className="jn-wrap wide">
      <LigaNav />
      <p className="jn-step">🧪 пісочниця · фейкові дані · в базу нічого не пишеться</p>
      <h1 className="jn-h1">Тест жеребкування</h1>
      <p className="jn-lead">Наповни лігу гравцями і проведи жеребкування — щоб помацати UI/UX ще до реальних реєстрацій.</p>

      <div className="jn-card">
        <h3>Гравців: {players.length}</h3>
        <div className="jn-chips" style={{ marginBottom: 6 }}>
          <button className="jn-paybtn" onClick={() => add(4)}>+4</button>
          <button className="jn-paybtn" onClick={() => add(32 - players.length)}>Заповнити до 32</button>
          <span className="jn-chip">
            <input
              type="number" min={1} max={64} value={x}
              onChange={(e) => setX(Number(e.target.value) || 1)}
              style={{ width: 46, border: 'none', background: 'transparent', font: 'inherit', fontWeight: 800 }}
            />
          </span>
          <button className="jn-paybtn" onClick={() => add(x)}>+X гравців</button>
          <button className="jn-paybtn" onClick={() => { setPlayers([]); setMatches(null); }}>Скинути</button>
        </div>
        {players.length > 0 && (
          <div className="jn-roster" style={{ marginTop: 10 }}>
            {players.map((p) => (
              <div className="jn-rcard" key={p.id}>
                <div className="jn-ava sm">{p.nick[0]}</div>
                <div className="who"><b>{p.nick}</b><span className="jn-chip yellow">{LEVEL_LABEL[p.level]}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="jn-btn" disabled={players.length < 9} onClick={() => setMatches(draw(players))}>
        🎲 Провести жеребкування{players.length < 9 ? ' (треба 9+)' : ''}
      </button>

      {matches && (
        <>
          <div className="jn-card" style={{ marginTop: 16 }}>
            <h3>Пари ліги · {matches.length} матчів</h3>
            <div className="jn-matches">
              {matches.slice(0, 24).map((m, i) => (
                <div className="jn-match" key={i}>
                  <span className="n">{i + 1}</span>
                  <span className="vs"><b>{byId.get(m.a)?.nick}</b> vs <b>{byId.get(m.b)?.nick}</b></span>
                  <span className="res">— : —</span>
                </div>
              ))}
            </div>
            {matches.length > 24 && <p className="jn-hint" style={{ marginTop: 8 }}>…і ще {matches.length - 24} пар.</p>}
          </div>

          {my && (
            <div className="jn-card">
              <h3>Кабінет гравця {my.nick} · 0/{myMatches.length}</h3>
              <div className="jn-matches">
                {myMatches.map((m, i) => {
                  const opp = byId.get(m.a === my.id ? m.b : m.a)!;
                  return (
                    <div className="jn-match" key={i}>
                      <span className="n">{i + 1}</span>
                      <span className="vs"><b>{opp.nick}</b> · {LEVEL_LABEL[opp.level]} · @{opp.nick.toLowerCase()}</span>
                      <span className="res">— : —</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="jn-card">
            <h3>Рейтинг · старт ліги</h3>
            <div className="jn-matches">
              {[...players].sort((a, b) => b.level - a.level).slice(0, 12).map((p, i) => (
                <div className="jn-match" key={p.id}>
                  <span className="n">{i + 1}</span>
                  <span className="vs"><b>{p.nick}</b> · {LEVEL_LABEL[p.level]}</span>
                  <span className="res">0 оч</span>
                </div>
              ))}
            </div>
            <p className="jn-hint" style={{ marginTop: 8 }}>Після реальних матчів тут буде залік 50/50 і рух позицій.</p>
          </div>
        </>
      )}
    </div></main>
  );
}

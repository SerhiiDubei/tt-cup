'use client';
import type { CupMatch, CupPlayer } from '@/lib/cup/types';
import CupHero from '@/components/cup/CupHero';

type PMap = Record<string, CupPlayer>;

/** Show the full bracket skeleton (future rounds appear as "очікує" slots so the
 *  structure is visible up front), but hide auto-resolved byes and void matches —
 *  a reported match with a missing side or no winner was never a real contest. */
function visible(m: CupMatch): boolean {
  if (m.status === 'reported' && (m.winner === null || !m.a || !m.b)) return false;
  return true;
}

function MatchCard({
  m, players, onPick,
}: { m: CupMatch; players: PMap; onPick: (id: string) => void }) {
  const pa = m.a ? players[m.a] : null;
  const pb = m.b ? players[m.b] : null;
  const playable = !!(m.a && m.b);
  const reported = m.status === 'reported';
  // the loser of THIS match (only meaningful once reported with both sides)
  const loserId = reported && m.a && m.b ? (m.winner === m.a ? m.b : m.a) : null;

  const Row = ({ pid, p, score }: { pid: string | null; p: CupPlayer | null; score: number }) => {
    const win = reported && m.winner === pid;
    // "вилетів" only on the row where this player took their knockout loss
    // (a losers-bracket match whose loser has nowhere to go). Never on a winner.
    const knockedOut = !!pid && pid === loserId && m.loseTo === null && m.bracket !== 'GF';
    return (
      <div className={'cup-row' + (win ? ' w' : '')}>
        {p ? <CupHero player={p} size={34} showPower={false} /> : <div className="cup-tbd" />}
        <span className={'cup-name' + (knockedOut ? ' out' : '')}>
          {p ? p.name : 'очікує…'}
          {knockedOut && <span className="cup-outtag">вилетів</span>}
        </span>
        <span className="cup-score">{reported ? score : '–'}</span>
      </div>
    );
  };

  return (
    <button
      className={'cup-match' + (playable && !reported ? ' live' : '') + (reported ? ' done' : '')}
      onClick={() => playable && onPick(m.id)}
      disabled={!playable}
      title={m.label}
    >
      <span className="cup-mlabel">{m.label}</span>
      <Row pid={m.a} p={pa} score={m.scoreA} />
      <Row pid={m.b} p={pb} score={m.scoreB} />
    </button>
  );
}

function Column({
  rounds, players, onPick,
}: {
  rounds: { round: number; label: string; matches: CupMatch[] }[];
  players: PMap; onPick: (id: string) => void;
}) {
  return (
    <>
      {rounds.map((r) => (
        <div className="cup-col" key={r.round}>
          <div className="cup-colhead">{r.label}</div>
          <div className="cup-colbody">
            {r.matches.map((m) => (
              <MatchCard key={m.id} m={m} players={players} onPick={onPick} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function CupBracket({
  matches, players, onPick,
}: { matches: CupMatch[]; players: PMap; onPick: (id: string) => void }) {
  const group = (b: 'W' | 'L') => {
    const ms = matches.filter((m) => m.bracket === b && visible(m));
    const roundNos = [...new Set(ms.map((m) => m.round))].sort((x, y) => x - y);
    return roundNos.map((round) => {
      const rm = ms.filter((m) => m.round === round).sort((x, y) => x.slot - y.slot);
      return { round, label: rm[0]?.label ?? `Раунд ${round}`, matches: rm };
    });
  };

  const wb = group('W');
  const lb = group('L');
  const gf = matches.filter((m) => m.bracket === 'GF' && visible(m));

  return (
    <div className="cup-bracket">
      {wb.length > 0 && (
        <div className="cup-section">
          <h3 className="cup-secttitle">🏆 Верхня сітка</h3>
          <div className="cup-cols"><Column rounds={wb} players={players} onPick={onPick} /></div>
        </div>
      )}
      {lb.length > 0 && (
        <div className="cup-section">
          <h3 className="cup-secttitle">🛟 Нижня ліга — другий шанс</h3>
          <div className="cup-cols"><Column rounds={lb} players={players} onPick={onPick} /></div>
        </div>
      )}
      {gf.length > 0 && (
        <div className="cup-section cup-gf">
          <h3 className="cup-secttitle">⚡ Гранд-фінал</h3>
          <div className="cup-cols">
            <div className="cup-col">
              <div className="cup-colbody">
                {gf.map((m) => <MatchCard key={m.id} m={m} players={players} onPick={onPick} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

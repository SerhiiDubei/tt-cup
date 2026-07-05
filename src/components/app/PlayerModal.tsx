'use client';
import { useEffect } from 'react';
import HeroCard from '@/components/HeroCard';
import { computeStandings } from '@/lib/tournament/standings';
import { gamesFromSets } from '@/lib/tournament/scoring';
import type { Player, Match } from '@/lib/tournament/types';

const ROUND_LABEL: Record<string, string> = { QF: '1/4', SF: '1/2', F: 'фінал', BR: 'за 3-тє' };

export default function PlayerModal({ player, players, matches, onClose }: {
  player: Player; players: Player[]; matches: Match[]; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey); document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [onClose]);

  const byId = (id: string | null) => players.find((p) => p.id === id);
  const standings = computeStandings(players, matches);
  const pos = standings.findIndex((s) => s.id === player.id);
  const st = standings[pos];
  const mine = matches
    .filter((m) => (m.a === player.id || m.b === player.id) && m.status === 'reported' && m.b)
    .sort((a, b) => (a.stage === b.stage ? a.round.localeCompare(b.round) : a.stage === 'swiss' ? -1 : 1));

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="card" style={{ position: 'relative', maxHeight: '86vh', overflowY: 'auto' }}>
          <button className="a-close" style={{ position: 'absolute', top: 12, right: 12 }} onClick={onClose} aria-label="Закрити">✕</button>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 auto', transform: 'scale(.9)', transformOrigin: 'top left' }}>
              <HeroCard name={player.name} nickname={player.nickname} motto={player.motto} hero={player.hero} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{player.name}</h3>
              <p className="pl-nick" style={{ textAlign: 'left' }}>@{player.nickname}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <span className="chip">місце #{pos >= 0 ? pos + 1 : '—'}</span>
                <span className="chip win">{st ? `${st.wins}–${st.losses}` : '0–0'}</span>
                <span className="chip live">{st?.points ?? 0} очок</span>
                {st && <span className="chip">сети {st.gw}:{st.gl}</span>}
              </div>
            </div>
          </div>

          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, marginTop: 24, marginBottom: 12 }}>Матчі</h4>
          {mine.length === 0 ? (
            <p className="muted" style={{ color: 'var(--ink-soft)' }}>Ще не зіграно жодного матчу.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {mine.map((m) => {
                const isA = m.a === player.id;
                const opp = byId(isA ? m.b : m.a);
                const [ga, gb] = gamesFromSets(m.sets);
                const my = isA ? ga : gb, th = isA ? gb : ga;
                const win = m.winner === player.id;
                const sets = m.sets.map(([x, y]) => (isA ? `${x}:${y}` : `${y}:${x}`)).join('  ');
                const label = m.stage === 'swiss' ? `тур ${m.round}` : (ROUND_LABEL[m.round] || m.round);
                return (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12, border: '2.5px solid var(--line)', borderRadius: 12, padding: '10px 14px', background: 'var(--bg)' }}>
                    <span className="chip" style={{ fontSize: 10 }}>{label}</span>
                    <span style={{ fontWeight: 600 }}>vs {opp?.name || '—'} <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{sets}</span></span>
                    <span className="chip" style={{ background: win ? 'var(--lime)' : 'var(--coral)', color: win ? 'var(--ink)' : '#fff' }}>{my}:{th} {win ? 'W' : 'L'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

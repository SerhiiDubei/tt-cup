'use client';
import { useState } from 'react';
import HeroCard from '@/components/HeroCard';
import PlayerModal from '@/components/app/PlayerModal';
import type { Player, Match } from '@/lib/tournament/types';

export default function RosterGrid({ players, matches }: { players: Player[]; matches: Match[] }) {
  const [sel, setSel] = useState<Player | null>(null);
  return (
    <>
      <div className="grid-auto">
        {players.map((p, i) => (
          <button key={p.id} onClick={() => setSel(p)}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', justifySelf: 'center' }}
            className={'reveal in ' + (i % 2 ? 'tilt-r' : 'tilt-l')} aria-label={`Статистика ${p.name}`}>
            <HeroCard name={p.name} nickname={p.nickname} motto={p.motto} hero={p.hero} />
            <div style={{ marginTop: 8, font: '700 11px/1 var(--font-display)', color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              📊 статистика
            </div>
          </button>
        ))}
      </div>
      {sel && <PlayerModal player={sel} players={players} matches={matches} onClose={() => setSel(null)} />}
    </>
  );
}

'use client';
import { useState } from 'react';
import type { Player, SetScore } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';
import PlayerPicker from '@/components/table/PlayerPicker';
import { byGender } from '@/components/table/bits';

/**
 * Після гри: «Хто далі?» — переможець лишається / обидва йдуть / пізніше.
 * `queue` — гравці з черги у порядку черги.
 */
export default function WhoNext({ winner, loser, sets, queue, onStart, onLater }: {
  winner: Player; loser: Player; sets: SetScore[]; queue: Player[];
  onStart: (a: string, b: string) => Promise<void>;
  onLater: () => void;
}) {
  const [pick, setPick] = useState<'stay' | 'both' | null>(null);

  // рахунок очима переможця: більші цифри — його
  const winnerIsA = sets.filter(([x, y]) => x > y).length * 2 > sets.length;
  const shown = winnerIsA ? sets : sets.map(([x, y]) => [y, x] as SetScore);
  const setsWon = `${shown.filter(([x, y]) => x > y).length}:${shown.filter(([x, y]) => x < y).length}`;

  return (
    <div className="k-scrim" role="dialog" aria-modal="true" aria-label="Хто грає далі">
      <div className="k-sheet k-next">
        <div className="k-sheet-head">
          <h2>ХТО ДАЛІ?</h2>
          <button className="k-close" onClick={onLater} aria-label="Закрити">✕</button>
        </div>

        <div className="k-next-body">
          <div className="k-next-result">
            <div className="k-next-champ">
              <span className="k-next-crown" aria-hidden="true">
                <svg viewBox="0 0 84 56" fill="none">
                  <path d="M8 44 L4 12 L26 28 L42 6 L58 28 L80 12 L76 44 Z"
                    fill="var(--yellow)" stroke="var(--line)" strokeWidth="5" strokeLinejoin="round" />
                  <circle cx="42" cy="36" r="5" fill="var(--pink)" stroke="var(--line)" strokeWidth="3" />
                </svg>
              </span>
              <div className="k-next-art">
                <HeroArt src={winner.hero?.art} alt={winner.nickname} color={winner.hero?.color || 'var(--yellow)'}
                  initial={(winner.nickname || '?').charAt(0).toUpperCase()} size={150} radius={24} />
              </div>
              <div className="k-next-name">{byGender(winner, 'ПЕРЕМІГ', 'ПЕРЕМОГЛА', 'ПЕРЕМІГ(ЛА)')}<br /><span>{winner.nickname || winner.name}</span></div>
            </div>
            <div className="k-next-score">
              <span className="big">{setsWon}</span>
              <span className="k-next-loser">проти {loser.nickname || loser.name}</span>
              <div className="k-next-sets">
                {shown.map((s, i) => (
                  <span key={i} className={'chip' + (s[0] > s[1] ? ' win' : '')}>{s[0]}:{s[1]}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="k-next-actions">
            <button className="kbtn xl pink" onClick={() => setPick('stay')}>ПЕРЕМОЖЕЦЬ ЛИШАЄТЬСЯ</button>
            <button className="kbtn xl cyan" onClick={() => setPick('both')}>ОБИДВА ЙДУТЬ</button>
            <button className="kbtn ghost-danger" onClick={onLater}>Пізніше</button>
          </div>
        </div>
      </div>

      {pick === 'stay' && (
        <PlayerPicker
          players={queue} count={1} preselected={queue.slice(0, 1).map((p) => p.id)}
          title={`ХТО ПРОТИ ${winner.nickname || winner.name}?`} confirmLabel="ДО СТОЛУ"
          onClose={() => setPick(null)}
          onConfirm={(ids) => onStart(winner.id, ids[0])}
        />
      )}
      {pick === 'both' && (
        <PlayerPicker
          players={queue} count={2} preselected={queue.slice(0, 2).map((p) => p.id)}
          title="ХТО ГРАЄ ДАЛІ?" confirmLabel="РОЗПОЧАТИ ГРУ"
          onClose={() => setPick(null)}
          onConfirm={(ids) => onStart(ids[0], ids[1])}
        />
      )}
    </div>
  );
}

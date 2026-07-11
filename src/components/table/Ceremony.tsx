'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import { leagueOf } from '@/lib/table/elo';
import HeroArt from '@/components/HeroArt';
import { NickFit, LeagueMedal } from '@/components/table/bits';

/**
 * Церемонія після гри (клієнтська, спека Addendum 2): конфеті + нік переможця +
 * «+Δ» великими; якщо гра підняла в нову лігу — другий біт: повноекранна медаль
 * і «ТЕПЕР ТИ {ЛІГА}». Будь-який тап — далі. Таймери прибираються в cleanup,
 * onDone захищений від подвійного тапу.
 */
export type CeremonyData = {
  winner: Player;
  delta: number;
  /** Рейтинг переможця ПІСЛЯ гри (prevRating + delta зі stateRef до finish). */
  newRating: number;
  /** Ліга змінилась цією грою (порівняння leagueOf до/після). */
  leagueUp: boolean;
  /** Нік того, кого обійшов у топі «весь час» (null — нікого). */
  overtook: string | null;
};

const BEAT1_MS = 3500;
const BEAT2_MS = 3200;

const CONF_COLORS = ['var(--pink)', 'var(--cyan)', 'var(--yellow)', 'var(--blue)', 'var(--coral)', 'var(--purple)', 'var(--lime)'];
const CONF_SHAPES = ['sq', 'dot', 'tri', 'strip'] as const;
const CONF_N = 30;

type Particle = {
  x: number; size: number; color: string; shape: (typeof CONF_SHAPES)[number];
  delay: number; dur: number; drift: number; rot: number;
};

function makeConfetti(): Particle[] {
  return Array.from({ length: CONF_N }, (_, i) => ({
    x: Math.random() * 100,
    size: 9 + Math.random() * 9,
    color: CONF_COLORS[i % CONF_COLORS.length],
    shape: CONF_SHAPES[i % CONF_SHAPES.length],
    delay: -Math.random() * 2.4,        // від'ємний старт: дощ уже йде на першому кадрі
    dur: 2.6 + Math.random() * 1.8,
    drift: (Math.random() - 0.5) * 30,  // легкий боковий знос, vw
    rot: 260 + Math.random() * 480,
  }));
}

export default function Ceremony({ data, onDone }: { data: CeremonyData; onDone: () => void }) {
  const { winner, delta, newRating, leagueUp, overtook } = data;
  const [beat, setBeat] = useState<'delta' | 'league'>('delta');
  const particles = useMemo(makeConfetti, []);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return; // подвійний тап / таймер поверх тапу — не страшно
    doneRef.current = true;
    onDone();
  };
  const advance = () => {
    if (beat === 'delta' && leagueUp) setBeat('league');
    else finish();
  };

  useEffect(() => {
    const t = setTimeout(advance, beat === 'delta' ? BEAT1_MS : BEAT2_MS);
    return () => clearTimeout(t);
    // advance навмисно поза deps: важливий лише актуальний beat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  return (
    <div className="k-cere" role="dialog" aria-modal="true" aria-label="Церемонія переможця"
      onPointerDown={advance}>
      <div className="k-conf" aria-hidden="true">
        {particles.map((p, i) => (
          <i key={i} className={p.shape}
            style={{
              left: `${p.x}vw`,
              background: p.shape === 'tri' ? 'transparent' : p.color,
              borderBottomColor: p.shape === 'tri' ? p.color : undefined,
              width: p.size, height: p.shape === 'strip' ? p.size * 2.3 : p.size,
              animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
              ['--dx' as string]: `${p.drift}vw`,
              ['--rot' as string]: `${p.rot}deg`,
            }} />
        ))}
      </div>

      {beat === 'delta' ? (
        <div className="k-cere-inner" key="delta">
          <span className="k-cere-kicker">ПЕРЕМОГА</span>
          <div className="k-cere-art">
            <HeroArt src={winner.hero?.art} alt={winner.nickname} color={winner.hero?.color || 'var(--yellow)'}
              initial={(winner.nickname || winner.name || '?').charAt(0).toUpperCase()} size={168} radius={26} />
          </div>
          <div className="k-cere-nick"><NickFit nick={winner.nickname || winner.name} oneLine shrink={false} /></div>
          <div className="k-cere-delta">+{delta}</div>
          {overtook && <div className="k-cere-pass">обійшов <b>@{overtook}</b></div>}
        </div>
      ) : (
        <div className="k-cere-inner league" key="league">
          <span className="k-cere-rays" aria-hidden="true">
            <svg viewBox="0 0 200 200">
              <polygon points="198.0,100.0 138.6,110.4 184.9,149.0 128.3,128.3 149.0,184.9 110.4,138.6 100.0,198.0 89.6,138.6 51.0,184.9 71.7,128.3 15.1,149.0 61.4,110.4 2.0,100.0 61.4,89.6 15.1,51.0 71.7,71.7 51.0,15.1 89.6,61.4 100.0,2.0 110.4,61.4 149.0,15.1 128.3,71.7 184.9,51.0 138.6,89.6"
                fill="var(--yellow)" opacity=".28" />
            </svg>
          </span>
          <div className="k-cere-medal"><LeagueMedal rating={newRating} size={168} /></div>
          <div className="k-cere-league">
            ТЕПЕР ТИ<br /><b>{leagueOf(newRating).name}</b>
          </div>
        </div>
      )}

      <span className="k-cere-hint">тапни, щоб продовжити</span>
    </div>
  );
}

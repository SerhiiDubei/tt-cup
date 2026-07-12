'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import { leagueOf } from '@/lib/table/elo';
import HeroArt from '@/components/HeroArt';
import { NickFit, LeagueMedal, byGender } from '@/components/table/bits';
import { readPalette, mulberry32, drawConfettiPiece } from '@/lib/anim/sprites';

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

/**
 * Процедурні залпи конфеті на canvas — «подія» поверх фонового CSS-дощу
 * (.k-conf лишається як амбієнт). Хвилі по біту: 'delta' — фонтан знизу +
 * бокові гармати; 'league' — золоте кільце навколо медалі. Фізика:
 * гравітація + затухання + флатер. Цикл живе, поки є частинки.
 */
function CeremonyFx({ beat }: { beat: 'delta' | 'league' }) {
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const pal = readPalette(cv);
    const rnd = mulberry32(beat === 'delta' ? 0xC0FE77 : 0x901D);
    const cols = beat === 'delta'
      ? [pal.pink, pal.cyan, pal.yellow, pal.purple, pal.lime, pal.coral]
      : [pal.yellow, pal.lime, '#FFE34D', pal.coral]; // ліга — золота гама

    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.max(1, Math.round(W * dpr));
      cv.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    type P = {
      x: number; y: number; vx: number; vy: number;
      rot: number; vr: number; c: string; shape: number; size: number;
      life: number; flut: number;
    };
    const ps: P[] = [];
    const burst = (x: number, y: number, n: number, dir: number, spread: number, sp0: number, sp1: number) => {
      for (let i = 0; i < n; i++) {
        const a = dir + (rnd() - .5) * 2 * spread;
        const sp = sp0 + rnd() * (sp1 - sp0);
        ps.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          rot: rnd() * Math.PI, vr: (rnd() - .5) * 14,
          c: cols[i % cols.length], shape: i % 3, size: 6 + rnd() * 6,
          life: 1, flut: rnd() * Math.PI * 2,
        });
      }
    };

    // таймлайн залпів (мс від старту біта) — без setTimeout, через elapsed
    const plan = beat === 'delta'
      ? [
        { at: 60, fire: () => burst(W * .5, H * .82, 46, -Math.PI / 2, .55, 520, 980) },
        { at: 480, fire: () => { burst(W * .05, H * .68, 24, -Math.PI / 3.4, .3, 620, 900); burst(W * .95, H * .68, 24, -Math.PI + Math.PI / 3.4, .3, 620, 900); } },
        { at: 1500, fire: () => burst(W * .5, H * .3, 20, -Math.PI / 2, Math.PI, 220, 420) },
        { at: 2300, fire: () => { burst(W * .12, H * .8, 16, -Math.PI / 2.6, .3, 540, 800); burst(W * .88, H * .8, 16, -Math.PI + Math.PI / 2.6, .3, 540, 800); } },
      ]
      : [
        { at: 60, fire: () => burst(W * .5, H * .45, 40, 0, Math.PI, 300, 560) },
        { at: 900, fire: () => burst(W * .5, H * .45, 22, 0, Math.PI, 200, 380) },
        { at: 1900, fire: () => burst(W * .5, H * .4, 26, -Math.PI / 2, .8, 380, 640) },
      ];
    let planIdx = 0, elapsed = 0;

    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(50, now - last); last = now;
      elapsed += dt;
      while (planIdx < plan.length && elapsed >= plan[planIdx].at) plan[planIdx++].fire();

      const drag = Math.exp(-dt / 900);
      for (const p of ps) {
        p.flut += dt * .006;
        p.x += (p.vx * dt) / 1000 + Math.sin(p.flut) * 14 * dt / 1000;
        p.y += (p.vy * dt) / 1000;
        p.vx *= drag; p.vy = p.vy * drag + 640 * dt / 1000;
        p.rot += (p.vr * dt) / 1000;
        p.life -= dt / 2600;
      }
      for (let i = ps.length - 1; i >= 0; i--) {
        if (ps[i].life <= 0 || ps[i].y > H + 30) ps.splice(i, 1);
      }

      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        drawConfettiPiece(ctx, p.x, p.y, p.rot, p.size, p.c, p.shape, Math.min(1, p.life * 2.2));
      }
      // всі залпи відстріляли й частинок нема — цикл більше не потрібен
      if (planIdx >= plan.length && ps.length === 0) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [beat]);

  return <canvas ref={cvRef} className="k-cere-fx" aria-hidden="true" />;
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
      <CeremonyFx beat={beat} />
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
          {overtook && <div className="k-cere-pass">{byGender(winner, 'обійшов', 'обійшла')} <b>@{overtook}</b></div>}
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

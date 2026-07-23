'use client';

import { useState } from 'react';
import Prologue from '../intro/Prologue';
import { Chapter, Layer, Beat, span, lerp, useTrigger } from './Scroll';
import { ScrubSprite, FpsSprite } from './Sprite';
import { HERO3 } from './hero3';
import { BallWalker } from './BallFolk';
import { pock, tada } from './sound';

const INK = '#16110D';

/** Обгортка сцени з хитавицею і локальним шейком (удар мʼяча). */
function Stage({ p, shakes = [], children }: { p: number; shakes?: number[]; children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  // тригери шейку — по одному хуку на поріг (список стабільний per сцена)
  /* eslint-disable react-hooks/rules-of-hooks */
  shakes.forEach((at) => useTrigger(p, at, () => { setTick((t) => t + 1); pock(1.3); }));
  /* eslint-enable react-hooks/rules-of-hooks */
  return <div className={`v3-stage v3-sway ${tick % 2 ? 'sh-a' : tick > 0 ? 'sh-b' : ''}`}>{children}</div>;
}

function Line({ p, at, until = 2, pos, dark = false, big = false, children }: {
  p: number; at: number; until?: number; pos: React.CSSProperties; dark?: boolean; big?: boolean; children: React.ReactNode;
}) {
  return (
    <Beat p={p} at={at} until={until} fx="up" className={`v3-line ${dark ? 'dark' : ''} ${big ? 'big' : ''}`} style={pos}>
      {children}
    </Beat>
  );
}

// ───────────────────────── ГЛАВА 1: ЛІГА ─────────────────────────
function ChapterLiga() {
  return (
    <Chapter beats={2.6} className="bg3-coral">
      {(p) => (
        <Stage p={p}>
          <span className="v3-chip">Розділ 1 · Ліга</span>
          <Layer p={p} depth={16} className="l-cal">
            <svg viewBox="0 0 400 300" className="v3-svg" aria-hidden>
              <rect x="70" y="30" width="260" height="240" rx="16" fill="#FFF8EC" stroke={INK} strokeWidth="6" />
              <rect x="70" y="30" width="260" height="52" rx="16" fill="#FF2E88" stroke={INK} strokeWidth="6" />
              {[0, 1].map((row) =>
                [0, 1, 2, 3, 4, 5, 6].map((col) => {
                  const idx = row * 7 + col;
                  const crossed = p > 0.25 + idx * 0.04;
                  return (
                    <g key={idx}>
                      <rect x={86 + col * 34} y={108 + row * 66} width="26" height="40" rx="5" fill="none" stroke={INK} strokeWidth="3.5" />
                      {crossed && (
                        <path d={`M${88 + col * 34} ${112 + row * 66} l22 32 M${110 + col * 34} ${112 + row * 66} l-22 32`} stroke="#FF5A36" strokeWidth="5" strokeLinecap="round" />
                      )}
                    </g>
                  );
                })
              )}
            </svg>
          </Layer>
          <Line p={p} at={0.04} until={0.4} pos={{ top: '9%', left: '7%', maxWidth: '78%' }} big>
            Два тижні ліги.
          </Line>
          <Line p={p} at={0.3} until={0.68} pos={{ top: '9%', left: '7%', maxWidth: '82%' }}>
            Реєструєшся — система розкидає пари. Кожен закреслений день — чийсь зіграний матч.
          </Line>
          {/* пара мʼячиків знайшла одне одного */}
          <Beat p={p} at={0.34} fx="pop" className="v3-beat-abs" style={{ position: 'absolute', bottom: '6svh', left: '10%' }}>
            <BallWalker style="normal" hue={45} size={62} phase={0.2} pos={{ position: 'relative' }} />
          </Beat>
          <Beat p={p} at={0.4} fx="pop" className="v3-beat-abs" style={{ position: 'absolute', bottom: '6svh', right: '12%' }}>
            <BallWalker style="hop" hue={200} size={58} flip pos={{ position: 'relative' }} />
          </Beat>
          <Line p={p} at={0.62} until={2} pos={{ top: '9%', left: '7%', maxWidth: '82%' }}>
            Домовляєтесь самі — телеграм суперника в профілі.
          </Line>
          <Beat p={p} at={0.75} fx="pop" className="v3-hero-slot" style={{ left: '-2%', height: '46%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO3.poses.point} alt="" className="v3-hero-img" />
          </Beat>
          <Beat p={p} at={0.85} fx="onoma" className="v3-onoma" style={{ right: '8%', top: '30%' }}>
            ГОУ!
          </Beat>
        </Stage>
      )}
    </Chapter>
  );
}

// ─────────────────────── ГЛАВА 2: ГРАЙ БУДЬ-ДЕ ───────────────────────
function ChapterAnywhere() {
  return (
    <Chapter beats={3.2} className="bg3-ink">
      {(p) => {
        const walkX = lerp(-24, 72, p);
        const cycle = (p * 4) % 1;
        return (
          <Stage p={p} shakes={[0.42, 0.68]}>
            <span className="v3-chip light">Розділ 2 · Де граємо</span>
            <Layer p={p} depth={30} className="l-sun">
              <i className="v3-sun" />
            </Layer>
            <Layer p={p} depth={18} x={-6} className="l-tree">
              <svg viewBox="0 0 120 160" className="v3-svg" aria-hidden>
                <circle cx="60" cy="52" r="44" fill="#A6E22E" stroke={INK} strokeWidth="5" />
                <path d="M60 96 V150" stroke={INK} strokeWidth="8" />
              </svg>
            </Layer>
            <Layer p={p} depth={8} className="l-lake">
              <i className="v3-lake" />
            </Layer>
            <Layer p={p} depth={3} className="l-table">
              <svg viewBox="0 0 260 120" className="v3-svg" aria-hidden>
                <rect x="10" y="34" width="240" height="13" rx="4" fill="#00CFC1" stroke={INK} strokeWidth="5" />
                <path d="M36 47 L26 108 M224 47 L234 108" stroke="#FBF1DD" strokeWidth="6" />
                <rect x="124" y="16" width="8" height="18" fill="#FBF1DD" />
              </svg>
            </Layer>
            <div className="v3-walker" style={{ left: `${walkX}vw` }}>
              {HERO3.walk ? (
                <ScrubSprite sheet={HERO3.walk} value={cycle} className="v3-walk-sprite" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={HERO3.poses.stroll} alt="" className="v3-hero-img" />
              )}
            </div>
            {/* перехожі мʼячики — амбіентне життя вулиці */}
            <BallWalker style="rush" hue={0} size={54} cross={{ duration: 9 }} pos={{ bottom: '3svh' }} />
            <BallWalker style="sneak" hue={280} size={48} cross={{ duration: 16, delay: 4 }} pos={{ bottom: '9svh' }} />
            <BallWalker style="hop" hue={130} size={44} cross={{ duration: 12, delay: 8 }} pos={{ bottom: '14svh' }} />
            <Line p={p} at={0.06} until={0.26} pos={{ top: '10%', left: '8%' }} dark big>
              Де граємо?
            </Line>
            <Line p={p} at={0.28} until={0.5} pos={{ top: '10%', left: '8%' }} dark>
              Зал клубу.
            </Line>
            <Line p={p} at={0.48} until={0.72} pos={{ top: '10%', left: '8%' }} dark>
              Стіл на промі.
            </Line>
            <Line p={p} at={0.7} until={0.92} pos={{ top: '10%', left: '8%' }} dark>
              Бетонка біля озера.
            </Line>
            <Line p={p} at={0.9} until={2} pos={{ top: '10%', left: '8%' }} dark big>
              Є стіл — є гра.
            </Line>
            <Beat p={p} at={0.42} until={0.6} fx="onoma" className="v3-onoma" style={{ right: '12%', top: '38%' }}>
              ПЛЯЦЬ!
            </Beat>
          </Stage>
        );
      }}
    </Chapter>
  );
}

// ─────────────────── ГЛАВА 3: ЧЕСНІСТЬ І РЕЙТИНГ ───────────────────
function ChapterHonesty() {
  return (
    <Chapter beats={2.8} className="bg3-cream">
      {(p) => {
        const bars = [0.55, 0.85, 0.4, 0.68];
        const grow = span(p, 0.45, 0.85);
        return (
          <Stage p={p}>
            <span className="v3-chip">Розділ 3 · Чесна гра</span>
            <Layer p={p} depth={14} className="l-phone">
              <svg viewBox="0 0 160 300" className="v3-svg" aria-hidden>
                <rect x="14" y="8" width="132" height="284" rx="20" fill="#FFF8EC" stroke={INK} strokeWidth="6" />
                <rect x="30" y="42" width="100" height="34" rx="9" fill="#A6E22E" stroke={INK} strokeWidth="4" />
                <text x="80" y="66" textAnchor="middle" fontSize="21" fontWeight="900" fill={INK} fontFamily="Unbounded, sans-serif">11:7</text>
                <rect x="30" y="88" width="100" height="34" rx="9" fill="#FFC619" stroke={INK} strokeWidth="4" />
                <text x="80" y="112" textAnchor="middle" fontSize="21" fontWeight="900" fill={INK} fontFamily="Unbounded, sans-serif">7:11</text>
                {bars.map((h, i) => (
                  <rect key={i} x={32 + i * 26} y={270 - 120 * h * grow} width="18" height={120 * h * grow} rx="5"
                    fill={['#FF2E88', '#FFC619', '#00CFC1', '#8A45FF'][i]} stroke={INK} strokeWidth="3.5" />
                ))}
                <path d="M28 270 H132" stroke={INK} strokeWidth="5" strokeLinecap="round" />
              </svg>
            </Layer>
            <Line p={p} at={0.05} until={0.32} pos={{ top: '9%', left: '7%', maxWidth: '80%' }} big>
              Рахунок вносите самі.
            </Line>
            <Line p={p} at={0.28} until={0.55} pos={{ top: '9%', left: '7%', maxWidth: '84%' }}>
              Після матчу оцінюєш: чи грав суперник на свій заявлений рівень?
            </Line>
            <Line p={p} at={0.52} until={0.8} pos={{ top: '9%', left: '7%', maxWidth: '84%' }}>
              Рейтинг живе онлайн — видно, хто де. Хитруни світяться швидко.
            </Line>
            <Line p={p} at={0.78} until={2} pos={{ top: '9%', left: '7%', maxWidth: '84%' }}>
              Морозиш матчі — 0:0 і мінус шанси на топ.
            </Line>
            <Beat p={p} at={0.3} until={0.6} fx="onoma" className="v3-onoma small" style={{ right: '7%', top: '46%' }}>
              +1 +2 +3
            </Beat>
            <Beat p={p} at={0.15} fx="pop" className="v3-hero-slot" style={{ right: '-4%', height: '48%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO3.poses.strict} alt="" className="v3-hero-img" />
            </Beat>
          </Stage>
        );
      }}
    </Chapter>
  );
}

// ───────────────────────── ГЛАВА 4: ДЕНЬ Х ─────────────────────────
function ChapterDayX() {
  return (
    <Chapter beats={3} className="bg3-yellow">
      {(p) => {
        const sunY = lerp(46, 4, span(p, 0, 0.5));
        return (
          <Stage p={p} shakes={[0.5, 0.72]}>
            <span className="v3-chip">Розділ 4 · День Х</span>
            <i className="v3-sun big" style={{ top: `${sunY}%` }} />
            <Layer p={p} depth={6} className="l-arena">
              <svg viewBox="0 0 400 160" className="v3-svg" aria-hidden>
                <rect x="80" y="60" width="240" height="14" rx="4" fill="#2D4BFF" stroke={INK} strokeWidth="6" />
                <path d="M108 74 L96 140 M292 74 L304 140" stroke={INK} strokeWidth="7" />
                <rect x="195" y="40" width="9" height="22" fill={INK} />
                {[30, 70, 330, 370].map((x, i) => (
                  <circle key={x} cx={x} cy={i % 2 ? 120 : 132} r="11" fill="#FFF8EC" stroke={INK} strokeWidth="4" />
                ))}
              </svg>
            </Layer>
            <Line p={p} at={0.05} until={0.35} pos={{ top: '9%', left: '7%' }} big>
              День Х.
            </Line>
            <Line p={p} at={0.3} until={0.6} pos={{ top: '9%', left: '7%', maxWidth: '82%' }}>
              Топи ліги виходять у фінали наживо: столи, музика, люди.
            </Line>
            <Beat p={p} at={0.5} until={0.72} fx="onoma" className="v3-onoma" style={{ right: '10%', top: '26%' }}>
              БАМ!
            </Beat>
            <Line p={p} at={0.62} until={0.95} pos={{ top: '9%', left: '7%', maxWidth: '84%' }}>
              І міні-ігри: фанові очки рахуються нарівні зі спортивними. Середнячок має шанс.
            </Line>
            <Beat p={p} at={0.68} until={2} fx="pop" className="v3-target">
              <svg viewBox="0 0 120 120" className="v3-svg" aria-hidden>
                <circle cx="60" cy="60" r="52" fill="#FFF8EC" stroke={INK} strokeWidth="6" />
                <circle cx="60" cy="60" r="33" fill="#FF5A36" stroke={INK} strokeWidth="5" />
                <circle cx="60" cy="60" r="15" fill="#FFC619" stroke={INK} strokeWidth="5" />
                <text x="60" y="66" textAnchor="middle" fontSize="16" fontWeight="900" fill={INK} fontFamily="Unbounded, sans-serif">70</text>
              </svg>
            </Beat>
            <Beat p={p} at={0.4} fx="pop" className="v3-hero-slot" style={{ left: '-2%', height: '50%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO3.poses.hype} alt="" className="v3-hero-img" />
            </Beat>
            {/* натовп мʼячиків прибуває на День Х */}
            {p > 0.35 && (
              <>
                <BallWalker style="hop" hue={45} size={50} phase={0} pos={{ position: 'absolute', bottom: '9svh', right: '16%' }} />
                <BallWalker style="hop" hue={200} size={44} phase={0.33} pos={{ position: 'absolute', bottom: '8svh', right: '28%' }} />
                <BallWalker style="normal" hue={320} size={46} phase={0.5} flip pos={{ position: 'absolute', bottom: '4svh', right: '30%' }} />
                <BallWalker style="rush" hue={130} size={40} cross={{ duration: 8, delay: 2 }} pos={{ bottom: '2svh' }} />
              </>
            )}
          </Stage>
        );
      }}
    </Chapter>
  );
}

// ───────────────────────── ГЛАВА 5: ФІНАЛ ─────────────────────────
function ChapterFinale() {
  return (
    <Chapter beats={2.2} className="bg3-pink">
      {(p) => (
        <FinaleInner p={p} />
      )}
    </Chapter>
  );
}

function FinaleInner({ p }: { p: number }) {
  useTrigger(p, 0.25, () => tada());
  return (
    <Stage p={p}>
      <span className="v3-chip light">Фінал</span>
      {p > 0.2 && (
        <div className="v3-confetti" aria-hidden>
          {Array.from({ length: 26 }, (_, i) => (
            <i key={i} style={{
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 9) * 0.18}s`,
              background: ['#FFC619', '#00CFC1', '#A6E22E', '#FBF1DD', '#FF8A2A'][i % 5],
            }} />
          ))}
        </div>
      )}
      <Line p={p} at={0.08} until={0.5} pos={{ top: '10%', left: '8%', maxWidth: '84%' }} dark big>
        Три номінації.
      </Line>
      <Line p={p} at={0.35} until={2} pos={{ top: '10%', left: '8%', maxWidth: '86%' }} dark>
        Найкращий у тенісі. Найкращий у міні-іграх. Найкращий у комбо. Нагорода — за заслугами.
      </Line>
      <Beat p={p} at={0.3} fx="pop" className="v3-hero-slot" style={{ left: '50%', transform: 'translateX(-50%)', height: '52%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO3.poses.celebrate} alt="" className="v3-hero-img" />
      </Beat>
    </Stage>
  );
}

// ───────────────────────────── ІСТОРІЯ ─────────────────────────────
export default function Story() {
  return (
    <>
      {/* Пролог: дощ мʼячиків збирає DRUID BATTLE CUP; далі — скрол */}
      <section className="v3-prologue">
        <Prologue
          onEnter={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
          hint="гортай вниз — розкажу, як усе працює ↓"
        />
      </section>

      {/* Легенда вітається — короткий місток перед главами */}
      <Chapter beats={1.6} className="bg3-yellow">
        {(p) => (
          <Stage p={p}>
            <Beat p={p} at={0.05} fx="pop" className="v3-hero-slot" style={{ left: '50%', transform: 'translateX(-50%)', height: '54%' }}>
              {HERO3.talk ? (
                <FpsSprite sheet={HERO3.talk} className="v3-talk-sprite" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={HERO3.poses.still} alt="" className="v3-hero-img sway" />
              )}
            </Beat>
            <Line p={p} at={0.1} until={0.46} pos={{ top: '10%', left: '8%', maxWidth: '84%' }} big>
              Привіт. Я — Джеремі.
            </Line>
            <Line p={p} at={0.5} until={2} pos={{ top: '10%', left: '8%', maxWidth: '84%' }}>
              Гортай — покажу, як працює DRUID BATTLE CUP.
            </Line>
          </Stage>
        )}
      </Chapter>

      <ChapterLiga />
      <ChapterAnywhere />
      <ChapterHonesty />
      <ChapterDayX />
      <ChapterFinale />

      {/* CTA — звичайна секція наприкінці */}
      <section className="v3-cta">
        <h2>Побачимось за столом.</h2>
        <a href="/register" className="v3-cta-main">Зареєструватись →</a>
        <button type="button" className="v3-cta-again" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↺ ще раз історію
        </button>
      </section>
    </>
  );
}

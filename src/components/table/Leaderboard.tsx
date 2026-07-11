'use client';
import { useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import type { CasualGame, BoardRow } from '@/lib/table/types';
import type { WeeklyRow } from '@/lib/table/stats';
import { leagueOf } from '@/lib/table/elo';
import HeroArt from '@/components/HeroArt';
import {
  NickFit, FlameIcon, LeagueMedal, MoveChip, FormDots, TitleChip, PodiumCrown,
} from '@/components/table/bits';

const RANK_BG = ['var(--yellow)', 'var(--cyan)', 'var(--coral)'];

function ago(iso: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'щойно';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'вчора' : `${d} дн тому`;
}

/** Нік + Elo-дельта одного боку у стрічці ігор (чип тільки коли дельта не NULL). */
function FeedSide({ nick, won, delta }: {
  nick: string; won: boolean; delta: number | null | undefined;
}) {
  return (
    <span className="k-feed-side">
      <span className={'k-feed-nick' + (won ? ' won' : '')}><NickFit nick={nick} oneLine shrink={false} /></span>
      {delta != null && (
        delta > 0
          ? <em className="k-feed-delta win">+{delta}</em>
          : <em className="k-feed-delta lose">−{Math.abs(delta)}</em>
      )}
    </span>
  );
}

/** Набрані очки тижня: лаймовий герой-чип, мінус — приглушений корал, 0 — нейтральний. */
function GainChip({ gained, big }: { gained: number; big?: boolean }) {
  const cls = gained > 0 ? ' plus' : gained < 0 ? ' minus' : ' zero';
  const text = gained > 0 ? `+${gained}` : gained < 0 ? `−${Math.abs(gained)}` : '0';
  return <span className={'k-gain' + cls + (big ? ' big' : '')}>{text}</span>;
}

/** Уніфікований запис обох режимів: у тижневому герой — набрані, без стрілок/титулів. */
type TopEntry = {
  id: string; wins: number; losses: number;
  rating?: number; streak?: number; move?: number | null; form?: string; titles?: BoardRow['titles'];
  gained?: number;
};

const asEntries = (rows: BoardRow[]): TopEntry[] => rows;
const asWeekly = (rows: WeeklyRow[]): TopEntry[] => rows;

/**
 * Лідерборд: суб-таби «ТОП СТОЛУ» / «ОСТАННІ ІГРИ»; всередині топу — пігулки
 * періоду «ВЕСЬ ЧАС» (Elo, рух, форма, титули) / «ТИЖДЕНЬ» (гонка за набраними).
 * Топ-3 обох режимів — подіум-п'єдестал, далі звичайні ряди з 4-го місця.
 */
export default function Leaderboard({ rows, weekly, players, recent }: {
  rows: BoardRow[];
  weekly: WeeklyRow[];
  players: Map<string, Player>;
  recent: CasualGame[];
}) {
  const [sub, setSub] = useState<'top' | 'games'>('top');
  const [period, setPeriod] = useState<'all' | 'week'>('all');
  const nickOf = (id: string) => players.get(id)?.nickname || players.get(id)?.name || '· · ·';

  const isWeek = period === 'week';
  const entries = isWeek ? asWeekly(weekly) : asEntries(rows);
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  const art = (id: string, size: number, radius: number) => {
    const p = players.get(id);
    return (
      <HeroArt src={p?.hero?.art} alt={nickOf(id)} color={p?.hero?.color || 'var(--yellow)'}
        initial={nickOf(id).charAt(0).toUpperCase()} size={size} radius={radius} />
    );
  };

  /** Герой-цифра запису: Elo з медаллю ліги або набрані очки тижня. */
  const hero = (e: TopEntry, big: boolean) => (
    isWeek ? (
      <span className="k-lb-rate week">
        <GainChip gained={e.gained ?? 0} big={big} />
        <span className="lg">за тиждень</span>
      </span>
    ) : (
      <span className="k-lb-rate">
        <span className="num"><LeagueMedal rating={e.rating ?? 1000} size={big ? 30 : 26} /><b>{e.rating}</b></span>
        <span className="lg">{leagueOf(e.rating ?? 1000).name}</span>
      </span>
    )
  );

  return (
    <div className="k-board">
      <nav className="k-subtabs" aria-label="Лідерборд: розділи">
        <button className={'k-subtab yellow' + (sub === 'top' ? ' on' : '')} onClick={() => setSub('top')}>ТОП СТОЛУ</button>
        <button className={'k-subtab cyan' + (sub === 'games' ? ' on' : '')} onClick={() => setSub('games')}>ОСТАННІ ІГРИ</button>
        {sub === 'top' && (
          <span className="k-board-hint">
            {isWeek ? 'гонка тижня · набрані очки · з понеділка' : 'рейтинг Elo · ліга · рух за добу · форма'}
          </span>
        )}
      </nav>

      {sub === 'top' ? (
        <section className="k-lb" aria-label="Топ столу">
          <div className="k-lb-bar">
            <div className="k-period" role="tablist" aria-label="Період">
              <button role="tab" aria-selected={!isWeek}
                className={'k-pill' + (!isWeek ? ' on' : '')} onClick={() => setPeriod('all')}>ВЕСЬ ЧАС</button>
              <button role="tab" aria-selected={isWeek}
                className={'k-pill' + (isWeek ? ' on' : '')} onClick={() => setPeriod('week')}>ТИЖДЕНЬ</button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="k-board-empty">
              <i className="ttball bounce" />
              <p>{isWeek ? 'Цього тижня ще не грали — відкрий рахунок' : 'Ще ніхто не зіграв — стань першим у топі'}</p>
            </div>
          ) : (
            <div className="k-lb-list">
              {/* подіум топ-3: №1 по центру вище, №2 зліва, №3 справа */}
              <div className="k-podium" data-n={podium.length}>
                {[1, 0, 2].map((idx) => {
                  const e = podium[idx];
                  if (!e) return null;
                  const place = idx + 1;
                  return (
                    <div className={'k-podstack p' + place} key={e.id}>
                      <div className="k-pod">
                        {place === 1 && <PodiumCrown className="k-pod-crown" />}
                        <div className="k-pod-art">{art(e.id, place === 1 ? 104 : 76, place === 1 ? 22 : 16)}</div>
                        <div className="k-pod-nick"><NickFit nick={nickOf(e.id)} oneLine /></div>
                        <div className="k-pod-hero">{hero(e, place === 1)}</div>
                        <div className="k-pod-meta">
                          <span className="k-lb-wl"><b>{e.wins}</b><i>–</i>{e.losses}</span>
                          {!isWeek && <MoveChip move={e.move ?? null} />}
                          {!isWeek && e.form ? <FormDots form={e.form} /> : null}
                        </div>
                        {!isWeek && e.titles && e.titles.length > 0 && (
                          <div className="k-pod-titles">{e.titles.map((t) => <TitleChip key={t} title={t} size={16} />)}</div>
                        )}
                      </div>
                      <div className="k-pedestal" style={{ background: RANK_BG[idx] }} aria-hidden="true">
                        <b>{place}</b>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* решта — рядами з 4-го місця */}
              {rest.map((e, i) => (
                <div className="k-lb-row" key={e.id}>
                  <span className="k-lb-rank plain">{i + 4}</span>
                  <span className="k-lb-art">{art(e.id, 56, 14)}</span>
                  <span className="k-lb-main">
                    <span className="k-lb-nickline">
                      <span className="k-lb-nick"><NickFit nick={nickOf(e.id)} oneLine /></span>
                      {!isWeek && <MoveChip move={e.move ?? null} />}
                    </span>
                    {!isWeek && (e.form || (e.titles && e.titles.length > 0)) && (
                      <span className="k-lb-subline">
                        {e.form ? <FormDots form={e.form} /> : null}
                        {e.titles?.map((t) => <TitleChip key={t} title={t} size={16} />)}
                      </span>
                    )}
                  </span>
                  <span className="k-lb-stats">
                    <span className="k-lb-wl"><b>{e.wins}</b><i>–</i>{e.losses}</span>
                    {!isWeek && (
                      (e.streak ?? 0) >= 3
                        ? <span className="k-lb-streak hot"><FlameIcon />{e.streak}</span>
                        : <span className="k-lb-streak">{(e.streak ?? 0) > 0 ? `+${e.streak}` : '·'}</span>
                    )}
                  </span>
                  {hero(e, false)}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="k-feed" aria-label="Останні ігри">
          {recent.length === 0 ? (
            <div className="k-board-empty"><p>Тут зʼявляться зіграні матчі</p></div>
          ) : (
            <div className="k-feed-list">
              {recent.map((g) => {
                const winnerA = g.winner === g.a;
                return (
                  <div className="k-feed-item" key={g.id}>
                    <div className="k-feed-line">
                      <FeedSide nick={nickOf(g.a)} won={winnerA} delta={g.delta_a} />
                      <span className="k-feed-dash">–</span>
                      <FeedSide nick={nickOf(g.b)} won={!winnerA} delta={g.delta_b} />
                    </div>
                    <div className="k-feed-meta">
                      <span className="k-feed-sets">
                        {g.sets.map((s, i) => (
                          <em key={i} className={(winnerA ? s[0] > s[1] : s[1] > s[0]) ? 'w' : ''}>{s[0]}:{s[1]}</em>
                        ))}
                      </span>
                      <span className="k-feed-time">{ago(g.ended_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

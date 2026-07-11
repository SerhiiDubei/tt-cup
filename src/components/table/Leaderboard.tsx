'use client';
import { useState } from 'react';
import type { Player } from '@/lib/tournament/types';
import type { CasualGame, LeaderRow } from '@/lib/table/types';
import { leagueOf } from '@/lib/table/elo';
import HeroArt from '@/components/HeroArt';
import { NickFit, FlameIcon, LeagueMedal } from '@/components/table/bits';

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
function FeedSide({ nick, won, delta }: { nick: string; won: boolean; delta: number | null | undefined }) {
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

/**
 * Лідерборд: суб-таби «ТОП СТОЛУ» / «ОСТАННІ ІГРИ» — одна повноширинна
 * панель за раз (планшет-first). Рейтинг Elo — герой рядка, медаль ліги поруч.
 */
export default function Leaderboard({ rows, players, recent }: {
  rows: LeaderRow[];
  players: Map<string, Player>;
  recent: CasualGame[];
}) {
  const [sub, setSub] = useState<'top' | 'games'>('top');
  const nickOf = (id: string) => players.get(id)?.nickname || players.get(id)?.name || '· · ·';

  return (
    <div className="k-board">
      <nav className="k-subtabs" aria-label="Лідерборд: розділи">
        <button className={'k-subtab yellow' + (sub === 'top' ? ' on' : '')} onClick={() => setSub('top')}>ТОП СТОЛУ</button>
        <button className={'k-subtab cyan' + (sub === 'games' ? ' on' : '')} onClick={() => setSub('games')}>ОСТАННІ ІГРИ</button>
        {sub === 'top' && <span className="k-board-hint">рейтинг Elo · ліга · перемоги – поразки · серія</span>}
      </nav>

      {sub === 'top' ? (
        <section className="k-lb" aria-label="Топ столу">
          {rows.length === 0 ? (
            <div className="k-board-empty">
              <i className="ttball bounce" />
              <p>Ще ніхто не зіграв — стань першим у топі</p>
            </div>
          ) : (
            <div className="k-lb-list">
              {rows.map((r, i) => {
                const p = players.get(r.id);
                return (
                  <div className={'k-lb-row' + (i === 0 ? ' first' : '')} key={r.id}>
                    <span className={'k-lb-rank' + (RANK_BG[i] ? '' : ' plain')} style={{ background: RANK_BG[i] ?? 'var(--paper)' }}>{i + 1}</span>
                    <span className="k-lb-art">
                      <HeroArt src={p?.hero?.art} alt={nickOf(r.id)} color={p?.hero?.color || 'var(--yellow)'}
                        initial={nickOf(r.id).charAt(0).toUpperCase()} size={56} radius={14} />
                    </span>
                    <span className="k-lb-nick"><NickFit nick={nickOf(r.id)} oneLine /></span>
                    <span className="k-lb-stats">
                      <span className="k-lb-wl"><b>{r.wins}</b><i>–</i>{r.losses}</span>
                      {r.streak >= 3
                        ? <span className="k-lb-streak hot"><FlameIcon />{r.streak}</span>
                        : <span className="k-lb-streak">{r.streak > 0 ? `+${r.streak}` : '·'}</span>}
                    </span>
                    <span className="k-lb-rate">
                      <span className="num"><LeagueMedal rating={r.rating} size={26} /><b>{r.rating}</b></span>
                      <span className="lg">{leagueOf(r.rating).name}</span>
                    </span>
                  </div>
                );
              })}
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

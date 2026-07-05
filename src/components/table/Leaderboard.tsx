'use client';
import type { Player } from '@/lib/tournament/types';
import type { CasualGame, LeaderRow } from '@/lib/table/types';
import HeroArt from '@/components/HeroArt';
import { NickFit, FlameIcon } from '@/components/table/bits';

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

export default function Leaderboard({ rows, players, recent }: {
  rows: LeaderRow[];
  players: Map<string, Player>;
  recent: CasualGame[];
}) {
  const nickOf = (id: string) => players.get(id)?.nickname || players.get(id)?.name || '· · ·';

  return (
    <div className="k-board">
      <section className="k-lb">
        <div className="k-panel-head yellow"><h2>ТОП СТОЛУ</h2><span className="k-panel-sub">перемоги · поразки · серія</span></div>
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
                  <span className="k-lb-nick"><NickFit nick={nickOf(r.id)} shrink={false} /></span>
                  <span className="k-lb-wl"><b>{r.wins}</b><i>–</i>{r.losses}</span>
                  {r.streak >= 3
                    ? <span className="k-lb-streak hot"><FlameIcon /> {r.streak}</span>
                    : <span className="k-lb-streak">{r.streak > 0 ? `+${r.streak}` : '·'}</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="k-feed">
        <div className="k-panel-head cyan"><h2>ОСТАННІ ІГРИ</h2></div>
        {recent.length === 0 ? (
          <div className="k-board-empty"><p>Тут зʼявляться зіграні матчі</p></div>
        ) : (
          <div className="k-feed-list">
            {recent.map((g) => {
              const winnerA = g.winner === g.a;
              return (
                <div className="k-feed-item" key={g.id}>
                  <div className="k-feed-line">
                    <span className={'k-feed-nick' + (winnerA ? ' won' : '')}><NickFit nick={nickOf(g.a)} shrink={false} /></span>
                    <span className={'k-feed-nick second' + (!winnerA ? ' won' : '')}><NickFit nick={nickOf(g.b)} shrink={false} /></span>
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
    </div>
  );
}

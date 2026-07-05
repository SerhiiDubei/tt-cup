import type { Hero } from '@/lib/tournament/types';
import HeroArt from '@/components/HeroArt';

const STYLE_LABEL: Record<string, string> = {
  attacker: 'АТАКЕР', defender: 'ЗАХИСНИК', allrounder: 'УНІВЕРСАЛ', spinner: 'СПІНЕР',
};

export default function HeroCard({
  name, nickname, hero, motto, rank,
}: { name: string; nickname: string; hero: Hero; motto?: string; rank?: string }) {
  const color = hero?.color || 'var(--yellow)';
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="hero-card">
      <div className="topbar">
        <span className="badge">{rank || STYLE_LABEL[hero?.style] || 'ГРАВЕЦЬ'}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, opacity: 0.5 }}>
          {hero?.emblem || '★'}
        </span>
      </div>
      <HeroArt src={hero?.art} alt={name} color={color} initial={initial} />
      <div className="pl-name">{name || 'ТВОЄ ІМʼЯ'}</div>
      <div className="pl-nick">@{nickname || 'nickname'}</div>
      <div className="pl-motto">{motto || '«готовий крутити топ-спін»'}</div>
      <div className="pl-style">
        <span className="chip" style={{ background: color }}>{STYLE_LABEL[hero?.style] || 'УНІВЕРСАЛ'}</span>
      </div>
    </div>
  );
}

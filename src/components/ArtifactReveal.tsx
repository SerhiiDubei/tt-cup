'use client';
import { useEffect } from 'react';
import type { Hero } from '@/lib/tournament/types';

const STYLE_LABEL: Record<string, string> = { attacker: 'АТАКЕР', defender: 'ЗАХИСНИК', allrounder: 'УНІВЕРСАЛ', spinner: 'СПІНЕР' };

export default function ArtifactReveal({
  hero, name, nickname, motto, onClose,
}: { hero: Hero; name?: string; nickname?: string; motto?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [onClose]);

  return (
    <div className="artifact-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="artifact">
        <div className="glow" aria-hidden="true" />
        <button className="a-close" onClick={onClose} aria-label="Закрити">✕</button>
        <span className="spark" style={{ top: 14, left: 16 }} aria-hidden="true">✦</span>
        <span className="spark" style={{ bottom: 90, right: 18, animationDelay: '.5s' }} aria-hidden="true">★</span>
        <div className="inner">
          <span className="rarity">★ героя створено ★</span>
          <div className="big-art">
            {hero.art ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.art} alt={name || 'герой'} />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', background: hero.color, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 80, color: 'var(--ink)' }}>
                {(name || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="a-name">{name?.trim() || 'ТВІЙ ГЕРОЙ'}</div>
          {nickname && <div className="a-nick">@{nickname}</div>}
          <div style={{ marginTop: 10 }}><span className="chip" style={{ background: hero.color }}>{STYLE_LABEL[hero.style] || 'УНІВЕРСАЛ'}</span></div>
          {motto && <p className="a-motto">«{motto}»</p>}
          <button className="btn pink" style={{ marginTop: 20 }} onClick={onClose}>Чудово! →</button>
        </div>
      </div>
    </div>
  );
}

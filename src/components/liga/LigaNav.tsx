'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { GOOGLE_AUTH_ENABLED, supaBrowser } from '@/lib/ligaAuth';
import { readCache, writeCache, clearLigaCaches } from '@/lib/ligaCache';

/**
 * ЄДИНИЙ хедер сервісу (D-043/D-044, аудит R-012):
 *  · зліва лого (веде на головну), центр — розділи з підсвіткою активного;
 *  · справа — АКАУНТ як у людей: аватар (фото Google / ініціали) з дропдауном
 *    «Мій профіль · Мій турнір · Вийти», для гостя — кнопка «Увійти»;
 *  · статус входу видно одразу.
 */

type Who = { name: string; avatar: string | null } | null;

const LINKS: [string, string][] = [
  ['/standings', 'Сітка'],
  ['/schedule', 'Розклад'],
  ['/players', 'Гравці'],
  ['/pravyla', 'Правила'],
];

export default function LigaNav() {
  const [who, setWho] = useState<Who>(null);
  const [hasToken, setHasToken] = useState(false);
  const [open, setOpen] = useState(false);       // мобільне меню
  const [menu, setMenu] = useState(false);       // дропдаун акаунта
  const path = usePathname();
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setHasToken(!!localStorage.getItem('dbc_token')); } catch { /* ок */ }
    const cw = readCache<Who>('dbc_cache_who');
    if (cw) setWho(cw);
    if (!GOOGLE_AUTH_ENABLED) return;
    supaBrowser().auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const m = session.user.user_metadata as { full_name?: string; avatar_url?: string };
      const w = { name: m.full_name || session.user.email || 'Ти', avatar: m.avatar_url || null };
      setWho(w);
      writeCache('dbc_cache_who', w);
    });
  }, []);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  async function logout() {
    try {
      if (GOOGLE_AUTH_ENABLED) await supaBrowser().auth.signOut();
      localStorage.removeItem('dbc_token');
      localStorage.removeItem('dbc_mock');
      clearLigaCaches();
    } catch { /* ок */ }
    location.href = '/standings';
  }

  const signedIn = !!who || hasToken;
  const initials = who?.name ? who.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '🙂';

  return (
    <header>
      <Link href="/" className="logo" aria-label="DRUID BATTLE CUP">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo-jeremy" src="/v2/dialog/smile.png" alt="" />
        <span className="logo-txt">DRUID BATTLE CUP</span>
      </Link>
      <nav className={'nav-links' + (open ? ' open' : '')}>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={path?.startsWith(href) ? 'active' : ''} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
        <a href="https://ttcup-onboard.vercel.app" onClick={() => setOpen(false)}>🎬 Як це працює</a>
      </nav>
      <div className="nav-tools">
        {signedIn ? (
          <div className="acct" ref={ddRef}>
            <button className="acct-btn" aria-label="Акаунт" onClick={() => setMenu((m) => !m)}>
              {who?.avatar
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={who.avatar} alt="" referrerPolicy="no-referrer" />
                : <span>{initials}</span>}
              <i className="acct-dot" aria-hidden />
            </button>
            {menu && (
              <div className="acct-menu">
                {who && <div className="acct-name">{who.name}</div>}
                <Link href="/me">👤 Мій профіль</Link>
                <Link href="/turnir/dbc">🏆 Мій турнір</Link>
                <button onClick={logout}>🚪 Вийти</button>
              </div>
            )}
          </div>
        ) : (
          <Link className="acct-login" href="/login">Увійти</Link>
        )}
        <button className="icon-btn burger" aria-label="Меню" onClick={() => setOpen((o) => !o)}>☰</button>
      </div>
    </header>
  );
}

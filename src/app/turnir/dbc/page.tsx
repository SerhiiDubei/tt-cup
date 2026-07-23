'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LigaNav from '@/components/liga/LigaNav';
import LigaLoader from '@/components/liga/LigaLoader';
import GoogleButton from '@/components/liga/GoogleButton';
import { GOOGLE_AUTH_ENABLED, supaBrowser } from '@/lib/ligaAuth';
import '../../liga.css';

/**
 * /turnir/dbc без токена (D-044): знаходимо ТВОЮ заявку — через збережений
 * лінк-вхід або Google-сесію — і ведемо в кабінет учасника.
 */
export default function TurnirResolver() {
  // R-013 #3: розрізняємо «нема заявки, БО не залогінений» і «залогінений,
  // але заявки нема» — щоб не пропонувати OAuth-петлю при активній сесії.
  const [state, setState] = useState<'busy' | 'guest' | 'no_entry'>('busy');

  useEffect(() => {
    (async () => {
      try {
        const t = localStorage.getItem('dbc_token');
        if (t) { location.replace(`/turnir/dbc/${t}`); return; }
      } catch { /* ок */ }
      if (GOOGLE_AUTH_ENABLED) {
        const { data: { session } } = await supaBrowser().auth.getSession();
        if (session) {
          const r = await fetch('/api/whoami', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token }),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d.token) { location.replace(`/turnir/dbc/${d.token}`); return; }
          setState('no_entry');
          return;
        }
      }
      setState('guest');
    })();
  }, []);

  return (
    <main className="jn-root"><div className="jn-wrap">
      <LigaNav />
      <p className="jn-step">DRUID BATTLE CUP</p>
      <h1 className="jn-h1">Мій турнір</h1>
      {state === 'busy' && <LigaLoader label="Шукаю твою заявку…" />}
      {state === 'no_entry' && (
        <>
          <p className="jn-lead">Ти увійшов, але заявки на лігу ще нема. Впишись — це 2 хвилини.</p>
          <Link className="jn-btn" href="/join">Вписатись у лігу · 420 грн</Link>
          <Link className="jn-btn ghost" href="/me">👤 Мій профіль</Link>
        </>
      )}
      {state === 'guest' && (
        <>
          <p className="jn-lead">Заявки не знайдено. Впишись у лігу — або увійди, якщо вже реєструвався.</p>
          <Link className="jn-btn" href="/join">Вписатись у лігу · 420 грн</Link>
          {GOOGLE_AUTH_ENABLED && (
            <GoogleButton />
          )}
        </>
      )}
    </div></main>
  );
}

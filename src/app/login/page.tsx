'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LigaNav from '@/components/liga/LigaNav';
import GoogleButton from '@/components/liga/GoogleButton';
import { GOOGLE_AUTH_ENABLED, signInWithGoogle, supaBrowser } from '@/lib/ligaAuth';
import '../liga.css';

/**
 * Вхід через Google (D-041): для тих, хто загубив токен-лінк або зайшов
 * з іншого пристрою. Сесія → /api/whoami → редірект у кабінет.
 */
export default function LoginPage() {
  const [state, setState] = useState<'idle' | 'busy' | 'no_player' | 'error'>('idle');

  useEffect(() => {
    if (!GOOGLE_AUTH_ENABLED) return;
    supaBrowser().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      setState('busy');
      try {
        const r = await fetch('/api/whoami', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.token) {
          try { localStorage.setItem('dbc_token', d.token); } catch { /* ок */ }
          location.href = `/turnir/dbc/${d.token}`;
          return;
        }
        setState(r.status === 404 ? 'no_player' : 'error');
      } catch { setState('error'); }
    });
  }, []);

  return (
    <main className="jn-root"><div className="jn-wrap">
      <LigaNav />
      <p className="jn-step">вхід у кабінет</p>
      <h1 className="jn-h1">Увійти</h1>
      {!GOOGLE_AUTH_ENABLED ? (
        <p className="jn-lead">Вхід через Google ось-ось увімкнеться. Поки що заходь за своїм особистим лінком з реєстрації.</p>
      ) : state === 'no_player' ? (
        <>
          <p className="jn-lead">З цим акаунтом заявки на лігу ще нема. Впишись — це 2 хвилини.</p>
          <Link className="jn-btn" href="/join">Зареєструватись →</Link>
        </>
      ) : state === 'error' ? (
        <>
          <p className="jn-lead">Щось пішло не так. Спробуй ще раз.</p>
          <GoogleButton />
        </>
      ) : (
        <>
          <p className="jn-lead">Увійди, щоб потрапити у свій профіль і кабінет турніру.</p>
          <GoogleButton label={state === 'busy' ? 'Шукаю твій кабінет…' : undefined} />
        </>
      )}
    </div></main>
  );
}

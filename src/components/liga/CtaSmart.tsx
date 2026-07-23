'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GOOGLE_AUTH_ENABLED, supaBrowser } from '@/lib/ligaAuth';

/**
 * Контекстний CTA (D-045, R-013 #4): враховує стан людини, включно з
 * Google-сесією на новому пристрої (whoami підтягує заявку і відновлює токен).
 * Гість → «Вписатись» + тихий лінк на історію; свій → «Мій турнір».
 */
export default function CtaSmart() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = localStorage.getItem('dbc_token');
        if (t) { setToken(t); setReady(true); return; }
      } catch { /* ок */ }
      if (GOOGLE_AUTH_ENABLED) {
        const { data: { session } } = await supaBrowser().auth.getSession();
        if (session) {
          try {
            const r = await fetch('/api/whoami', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ access_token: session.access_token }),
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.token) {
              try { localStorage.setItem('dbc_token', d.token); } catch { /* ок */ }
              setToken(d.token);
            }
          } catch { /* ок */ }
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <div style={{ minHeight: 72 }} aria-hidden />;
  if (token) return <Link className="jn-btn cyan" href={`/turnir/dbc/${token}`}>🏆 Мій турнір →</Link>;
  return (
    <>
      <Link className="jn-btn" href="/join">Вписатись у лігу · 420 грн</Link>
      <p className="jn-vollink" style={{ marginTop: 12 }}>
        Вперше тут? <a href="https://ttcup-onboard.vercel.app" style={{ fontWeight: 800, color: 'var(--blue)' }}>🎬 Подивись, як це працює</a>
      </p>
    </>
  );
}

'use client';

import { useEffect } from 'react';
import LigaLoader from '@/components/liga/LigaLoader';
import { GOOGLE_AUTH_ENABLED, supaBrowser } from '@/lib/ligaAuth';

const ONBOARD = 'https://ttcup-onboard.vercel.app';

/**
 * Корінь = вхідні двері (D-051): вирішує за станом людини.
 *  · НОВАЧОК (нема токена й сесії) → онбординг-історія — стартовий флоу;
 *  · СВІЙ → хаб /standings (інтро вже бачив, не мучимо).
 * Заставка — фірмовий мʼячик, тому переходу без білого флешу.
 */
export default function Home() {
  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem('dbc_token')) { location.replace('/standings'); return; }
      } catch { /* ок */ }
      if (GOOGLE_AUTH_ENABLED) {
        const { data: { session } } = await supaBrowser().auth.getSession();
        if (session) { location.replace('/standings'); return; }
      }
      location.replace(ONBOARD); // новачок → історія
    })();
  }, []);

  return (
    <main className="jn-root"><div className="jn-wrap">
      <LigaLoader label="Хвильку…" />
    </div></main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import './[token]/kabinet.css';

const TG = 'https://t.me/bomberman047';

/**
 * /kabinet без токена — короткий шлях «до себе».
 * Токен лишається у localStorage після першого відкриття кабінету,
 * тож повторний захід не потребує довгого посилання з чату.
 */
export default function KabinetShortcut() {
  const [state, setState] = useState<'look' | 'none'>('look');

  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem('dbc_token'); } catch { /* приватний режим */ }
    if (t) { window.location.replace(`/kabinet/${t}`); return; }
    setState('none');
  }, []);

  return (
    <div className="kb-root"><div className="kb-phone">
      {state === 'look' ? (
        <div className="kb-msg">Шукаю твій кабінет…</div>
      ) : (
        <div className="kb-msg">
          <b>НЕ ЗНАЙШОВ ТЕБЕ НА ЦЬОМУ ПРИСТРОЇ</b>
          Кабінет відкривається за особистим посиланням — воно прийшло в кінці реєстрації.
          Відкрий його один раз, і далі <b style={{ display: 'inline', fontSize: 'inherit' }}>/kabinet</b> вестиме сюди сам.
          <div className="kb-act" style={{ padding: '20px 0 0' }}>
            <a className="kb-btn" href={TG}>ПОПРОСИТИ ПОСИЛАННЯ</a>
            <a className="kb-btn ghost" href="https://dbc-onboarding.vercel.app/short">Зареєструватись</a>
          </div>
        </div>
      )}
    </div></div>
  );
}

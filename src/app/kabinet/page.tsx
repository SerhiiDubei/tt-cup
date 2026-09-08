'use client';

import { useCallback, useEffect, useState } from 'react';
import { GOOGLE_AUTH_ENABLED, signInWithGoogle } from '@/lib/ligaAuth';
import './[token]/kabinet.css';

const TG = 'https://t.me/bomberman047';
const REG = 'https://dbc-onboarding.vercel.app/short';

/**
 * Вбудовані браузери Instagram, Facebook, TikTok тощо.
 * Google свідомо не пускає в них OAuth (disallowed_useragent), тож вести
 * туди людину — це показати їй помилку Google замість входу.
 */
function inAppBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|Messenger|Twitter|TikTok|Snapchat|Line\/|MicroMessenger|Viber/i.test(ua);
}

type State = 'look' | 'none' | 'signing' | 'checking' | 'nomatch' | 'failed';

/**
 * /kabinet без токена — короткий шлях «до себе».
 *
 * Спершу localStorage (пристрій, з якого реєструвались). Якщо там порожньо,
 * заходимо через той самий Google, яким людина реєструвалась: сервер знаходить
 * заявку за auth_user_id і віддає особисте посилання.
 */
export default function KabinetShortcut() {
  const [state, setState] = useState<State>('look');
  const [email, setEmail] = useState<string | null>(null);
  const embedded = typeof window !== 'undefined' && inAppBrowser();

  /** Обмін сесії Google на особисте посилання. */
  const resolve = useCallback(async (accessToken: string) => {
    setState('checking');
    try {
      const r = await fetch('/api/kabinet/whoami', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      });
      const j = await r.json();
      if (r.ok && j.token) {
        try { localStorage.setItem('dbc_token', j.token); } catch { /* приватний режим */ }
        window.location.replace(`/kabinet/${j.token}`);
        return;
      }
      if (r.status === 404) { setEmail(j.email ?? null); setState('nomatch'); return; }
      setState('failed');
    } catch { setState('failed'); }
  }, []);

  useEffect(() => {
    // повернення від Google: сесія приїжджає в хеші
    const hash = window.location.hash || '';
    if (hash.includes('access_token=')) {
      const at = new URLSearchParams(hash.slice(1)).get('access_token');
      history.replaceState(null, '', window.location.pathname);
      if (at) { void resolve(at); return; }
    }
    if (hash.includes('error=')) { setState('failed'); history.replaceState(null, '', window.location.pathname); return; }

    let t: string | null = null;
    try { t = localStorage.getItem('dbc_token'); } catch { /* приватний режим */ }
    if (t) { window.location.replace(`/kabinet/${t}`); return; }
    setState('none');
  }, [resolve]);

  async function google() {
    setState('signing');
    try {
      await signInWithGoogle(`${window.location.origin}/kabinet`);
    } catch { setState('failed'); }
  }

  const Shell = ({ children }: { children: React.ReactNode }) =>
    <div className="kb-root"><div className="kb-phone"><div className="kb-msg">{children}</div></div></div>;

  if (state === 'look' || state === 'checking' || state === 'signing') return (
    <Shell>{state === 'checking' ? 'Шукаю твою заявку…' : state === 'signing' ? 'Відкриваю Google…' : 'Шукаю твій кабінет…'}</Shell>
  );

  if (state === 'nomatch') return (
    <Shell>
      <b>ЦЕЙ GOOGLE НЕ ПРИВʼЯЗАНИЙ ДО ЗАЯВКИ</b>
      {email ? <>Зайшов як <b style={{ display: 'inline', fontSize: 'inherit' }}>{email}</b>. </> : null}
      Під цим акаунтом реєстрації немає. Можливо, реєструвався іншою поштою — або ще не реєструвався взагалі.
      <div className="kb-act" style={{ padding: '20px 0 0' }}>
        <a className="kb-btn primary" href={REG}>ЗАРЕЄСТРУВАТИСЬ</a>
        <a className="kb-btn" href={TG}>Написати організатору</a>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <b>НЕ ЗНАЙШОВ ТЕБЕ НА ЦЬОМУ ПРИСТРОЇ</b>
      {state === 'failed' && <p className="kb-err" style={{ marginBottom: 12 }}>Вхід не вдався. Спробуй ще раз.</p>}
      Кабінет прив’язаний до пристрою. Але ти реєструвався через Google — увійди ним, і я знайду твою заявку.

      {embedded ? (
        <div className="kb-warn">
          <b>Спершу відкрий у справжньому браузері</b>
          Це вбудований браузер соцмережі — Google у ньому вхід не дозволяє.
          Натисни «•••» вгорі праворуч і обери <em>Відкрити в Safari</em> (або Chrome), тоді повертайся сюди.
        </div>
      ) : null}

      <div className="kb-act" style={{ padding: '20px 0 0' }}>
        {GOOGLE_AUTH_ENABLED && !embedded && (
          <button className="kb-btn primary" onClick={google}>УВІЙТИ ЧЕРЕЗ GOOGLE</button>
        )}
        <a className="kb-btn" href={TG}>ПОПРОСИТИ ПОСИЛАННЯ</a>
        <a className="kb-btn ghost" href={REG}>Зареєструватись</a>
      </div>
    </Shell>
  );
}

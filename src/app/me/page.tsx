'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LigaNav from '@/components/liga/LigaNav';
import GoogleButton from '@/components/liga/GoogleButton';
import LigaLoader from '@/components/liga/LigaLoader';
import { GOOGLE_AUTH_ENABLED, signInWithGoogle, supaBrowser } from '@/lib/ligaAuth';
import { readCache, writeCache, clearLigaCaches } from '@/lib/ligaCache';
import '../liga.css';

/**
 * ОСОБИСТИЙ КАБІНЕТ СЕРВІСУ (D-043): акаунт людини в TT Cup — профіль,
 * мої турніри, статистика (заглушка до підключення кіоска), вихід.
 * Турнірні речі (оплата/матчі) живуть ОКРЕМО: /turnir/dbc.
 */

type Profile = { display_name: string; nick: string; telegram: string; photo_url: string | null; email?: string };
type Entry = { token: string; kind: string; nick: string | null; first_name: string; paid: boolean; paid_claimed_at: string | null; pay_amount: number; volunteer: boolean };

export default function MePage() {
  const [state, setState] = useState<'loading' | 'guest' | 'token' | 'ok' | 'error'>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [dbReady, setDbReady] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // R-013 #1: власник токен-лінка БЕЗ Google — теж свій: показуємо профіль
  // із заявки (read-only) і місток «привʼяжи Google».
  async function loadFromToken(): Promise<boolean> {
    try {
      const t = localStorage.getItem('dbc_token');
      if (!t || t === 'local') return false;
      const r = await fetch(`/api/ya/${t}`, { cache: 'no-store' });
      if (!r.ok) return false;
      const { player } = await r.json();
      setProfile({
        display_name: `${player.first_name} ${player.last_name}`,
        nick: player.nick ?? '', telegram: player.telegram, photo_url: null,
      });
      setEntry({ ...player, token: t });
      setState('token');
      writeCache('dbc_cache_me', {
        profile: {
          display_name: `${player.first_name} ${player.last_name}`,
          nick: player.nick ?? '', telegram: player.telegram, photo_url: null,
        },
        entry: { ...player, token: t }, state: 'token',
      });
      return true;
    } catch { return false; }
  }

  useEffect(() => {
    // D-049: миттєвий рендер з кешу, мережа оновлює тихо у фоні
    const cached = readCache<{ profile: Profile; entry: Entry | null; state: 'ok' | 'token' }>('dbc_cache_me');
    if (cached) {
      setProfile(cached.profile);
      setEntry(cached.entry);
      setState(cached.state);
    }
    (async () => {
      const session = GOOGLE_AUTH_ENABLED
        ? (await supaBrowser().auth.getSession()).data.session
        : null;
      if (!session) {
        if (!(await loadFromToken())) setState('guest');
        return;
      }
      try {
        const r = await fetch('/api/account', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token, op: 'get' }),
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        // повернувся з Google, а заявка ще не привʼязана — привʼязуємо тихо
        if (!d.dbcEntry) {
          const t = localStorage.getItem('dbc_token');
          if (t && t !== 'local') {
            const lr = await fetch('/api/link-auth', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ token: t, access_token: session.access_token }),
            });
            if (lr.ok) {
              const r2 = await fetch('/api/account', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ access_token: session.access_token, op: 'get' }),
              });
              if (r2.ok) {
                const d2 = await r2.json();
                setProfile(d2.profile); setEntry(d2.dbcEntry); setDbReady(d2.dbReady !== false);
                setState('ok');
                writeCache('dbc_cache_me', { profile: d2.profile, entry: d2.dbcEntry, state: 'ok' });
                return;
              }
            }
          }
        }
        setProfile(d.profile);
        setEntry(d.dbcEntry);
        setDbReady(d.dbReady !== false);
        setState('ok');
        writeCache('dbc_cache_me', { profile: d.profile, entry: d.dbcEntry, state: 'ok' });
      } catch { if (!cached) setState('error'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true); setSaved(false);
    try {
      const { data: { session } } = await supaBrowser().auth.getSession();
      if (!session) return;
      const r = await fetch('/api/account', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token, op: 'save',
          display_name: profile.display_name, nick: profile.nick, telegram: profile.telegram,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.dbReady === false) setDbReady(false);
      else setSaved(true);
    } finally { setSaving(false); }
  }

  async function logout() {
    try {
      await supaBrowser().auth.signOut();
      localStorage.removeItem('dbc_token');
      clearLigaCaches();
    } catch { /* ок */ }
    location.href = '/standings';
  }

  return (
    <main className="jn-root"><div className="jn-wrap wide">
      <LigaNav />
      <p className="jn-step">акаунт у сервісі TT CUP</p>
      <h1 className="jn-h1">Мій профіль</h1>

      {state === 'loading' && <LigaLoader label="Відкриваю профіль…" skeleton />}

      {state === 'guest' && (
        <>
          <p className="jn-lead">Увійди, щоб мати профіль, свої турніри і статистику.</p>
          {GOOGLE_AUTH_ENABLED
            ? <GoogleButton />
            : <p className="jn-hint">Вхід через Google ось-ось увімкнеться.</p>}
          <Link className="jn-btn ghost" href="/join">Або одразу в лігу →</Link>
        </>
      )}

      {state === 'error' && (
        <>
          <p className="jn-lead">Не вдалося завантажити профіль.</p>
          <button className="jn-btn cyan" onClick={() => location.reload()}>Спробувати ще раз</button>
        </>
      )}

      {/* R-013 #1: свій за токен-лінком, без Google — профіль із заявки + місток привʼязки */}
      {state === 'token' && profile && entry && (
        <div className="jn-grid">
          <div>
            <div className="jn-card">
              <h3>Профіль</h3>
              <div className="jn-profile" style={{ margin: '4px 0 10px' }}>
                <div className="jn-ava">{(profile.display_name[0] ?? '?').toUpperCase()}</div>
                <div className="jn-profile-who">
                  <p style={{ margin: 0, fontWeight: 800 }}>{profile.display_name}</p>
                  <p className="jn-hint" style={{ margin: 0 }}>{profile.nick && `${profile.nick} · `}{profile.telegram}</p>
                </div>
              </div>
              {GOOGLE_AUTH_ENABLED && (
                <>
                  <p className="jn-hint">Увійди — і керуй профілем з будь-якого пристрою.</p>
                  <GoogleButton />
                </>
              )}
            </div>
          </div>
          <div>
            <div className="jn-card">
              <h3>Мої турніри</h3>
              <Link href={`/turnir/dbc/${entry.token}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div className="jn-match" style={{ borderStyle: 'solid' }}>
                  <span className="n">🏆</span>
                  <span className="vs">
                    <b>DRUID BATTLE CUP</b> · {entry.kind === 'volunteer' ? 'волонтер 🙌' : entry.paid ? '✅ у лізі' : entry.paid_claimed_at ? '🟡 оплата перевіряється' : '⏳ не оплачено'}
                  </span>
                  <span className="res">→</span>
                </div>
              </Link>
            </div>
            <div className="jn-card">
              <h3>Акаунт</h3>
              <button className="jn-btn ghost" onClick={logout}>🚪 Вийти</button>
            </div>
          </div>
        </div>
      )}

      {state === 'ok' && profile && (
        <div className="jn-grid">
          <div>
            <div className="jn-card">
              <h3>Профіль</h3>
              <div className="jn-profile" style={{ margin: '4px 0 10px' }}>
                {profile.photo_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img className="jn-ava" style={{ objectFit: 'cover' }} src={profile.photo_url} alt="" referrerPolicy="no-referrer" />
                  : <div className="jn-ava">{(profile.display_name[0] ?? '?').toUpperCase()}</div>}
                <div className="jn-profile-who">
                  <p className="jn-hint" style={{ margin: 0 }}>{profile.email}</p>
                </div>
              </div>
              <div className="jn-field"><label>Імʼя і прізвище</label>
                <input className="jn-input" maxLength={80} value={profile.display_name}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} /></div>
              <div className="jn-field"><label>Нік</label>
                <input className="jn-input" maxLength={24} value={profile.nick}
                  onChange={(e) => setProfile({ ...profile, nick: e.target.value })} /></div>
              <div className="jn-field"><label>Телеграм</label>
                <input className="jn-input" maxLength={40} value={profile.telegram}
                  onChange={(e) => setProfile({ ...profile, telegram: e.target.value })} /></div>
              {dbReady ? (
                <button className="jn-btn cyan" disabled={saving} onClick={save}>
                  {saving ? '…' : saved ? '✓ Збережено' : 'Зберегти'}
                </button>
              ) : (
                <p className="jn-hint" style={{ fontWeight: 700 }}>🧪 Редагування увімкнеться після оновлення бази (міграція accounts).</p>
              )}
            </div>

            <div className="jn-card">
              <h3>Статистика</h3>
              <p className="jn-hint" style={{ margin: 0 }}>
                Матчі, перемоги і рейтинг зі столу клубу підтягнуться сюди — скоро.
              </p>
            </div>
          </div>

          <div>
            <div className="jn-card">
              <h3>Мої турніри</h3>
              {entry ? (
                <Link className="jn-links-item" href={`/turnir/dbc/${entry.token}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div className="jn-match" style={{ borderStyle: 'solid' }}>
                    <span className="n">🏆</span>
                    <span className="vs">
                      <b>DRUID BATTLE CUP</b> · {entry.kind === 'volunteer' ? 'волонтер 🙌' : entry.paid ? '✅ у лізі' : entry.paid_claimed_at ? '🟡 оплата перевіряється' : '⏳ не оплачено'}
                    </span>
                    <span className="res">→</span>
                  </div>
                </Link>
              ) : (
                <>
                  <p className="jn-hint" style={{ marginTop: 0 }}>Поки жодного. Найближчий — DRUID BATTLE CUP, старт ліги 2 серпня.</p>
                  <Link className="jn-btn" href="/join">Вписатись · 420 грн</Link>
                </>
              )}
            </div>

            <div className="jn-card">
              <h3>Акаунт</h3>
              <button className="jn-btn ghost" onClick={logout}>🚪 Вийти з акаунта</button>
            </div>
          </div>
        </div>
      )}
    </div></main>
  );
}

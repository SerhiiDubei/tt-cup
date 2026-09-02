'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import LigaNav from '@/components/liga/LigaNav';
import LigaLoader from '@/components/liga/LigaLoader';
import { bankaLink, MOCK_PAY, TG_CONFIRM_URL, DRAW_DATE, LEVEL_LABEL } from '@/lib/liga';
import { GOOGLE_AUTH_ENABLED, signInWithGoogle, supaBrowser } from '@/lib/ligaAuth';
import { readCache, writeCache } from '@/lib/ligaCache';

type LigaPlayer = {
  num: number; kind: 'player' | 'volunteer';
  first_name: string; last_name: string; nick: string | null; telegram: string;
  level: number; is_sportik: boolean; volunteer: boolean; volunteer_roles: string[];
  pay_amount: number; paid: boolean; paid_claimed_at: string | null; created_at: string;
  payCode: string; googleLinked?: boolean;
};

/**
 * КАБІНЕТ УЧАСНИКА ТУРНІРУ (D-043/D-044): вшитий у двіж — повна навігація
 * (сітка/розклад/гравці/правила), шапка-банер профілю, «Мої матчі» на 8 слотів,
 * каундаун до жеребкування, двоколонковий десктоп. token 'local' = тест-запис.
 */

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  return { days: Math.floor(diff / 86_400_000), hours: Math.floor((diff % 86_400_000) / 3_600_000) };
}

export default function YaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<LigaPlayer | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'not_found' | 'error'>('loading');
  const [claiming, setClaiming] = useState(false);
  const isLocal = token === 'local';
  const cd = useCountdown(DRAW_DATE);

  useEffect(() => {
    if (!token) return;
    const cp = readCache<LigaPlayer>('dbc_cache_turnir_' + token);
    if (cp) { setP(cp); setState('ok'); }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Повернення з Google: якщо є сесія і акаунт ще не привʼязаний — привʼязуємо.
  useEffect(() => {
    if (!GOOGLE_AUTH_ENABLED || isLocal || !token) return;
    supaBrowser().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      await fetch('/api/link-auth', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, access_token: session.access_token }),
      }).catch(() => {});
      load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadLocal() {
    try {
      const raw = localStorage.getItem('dbc_mock');
      if (!raw) { setState('not_found'); return; }
      const m = JSON.parse(raw);
      setP({
        num: 0, kind: m.kind, first_name: m.firstName, last_name: m.lastName,
        nick: m.nick || null, telegram: m.telegram, level: m.level ?? 1,
        is_sportik: false, volunteer: !!m.volunteer, volunteer_roles: m.roles ?? [],
        pay_amount: m.amount ?? 0, paid: m.status === 'paid',
        paid_claimed_at: m.status === 'claimed' ? m.createdAt : null,
        created_at: m.createdAt, payCode: m.payCode,
      });
      setState('ok');
    } catch { setState('error'); }
  }

  async function load() {
    if (isLocal) { loadLocal(); return; }
    try {
      const r = await fetch(`/api/ya/${token}`, { cache: 'no-store' });
      if (r.status === 404) { setState('not_found'); return; }
      if (!r.ok) throw new Error();
      const { player } = await r.json();
      setP(player); setState('ok');
      writeCache('dbc_cache_turnir_' + token, player);
      try { localStorage.setItem('dbc_token', token); } catch { /* приватний режим */ }
    } catch { setState('error'); }
  }

  async function payAction() {
    if (isLocal) {
      try {
        const m = JSON.parse(localStorage.getItem('dbc_mock') || '{}');
        m.status = 'paid';
        localStorage.setItem('dbc_mock', JSON.stringify(m));
      } catch { /* ок */ }
      loadLocal();
      return;
    }
    setClaiming(true);
    try {
      const r = await fetch(`/api/ya/${token}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'claim_paid' }),
      });
      if (r.ok) { const { player } = await r.json(); setP(player); }
    } finally { setClaiming(false); }
  }

  const banka = p && !MOCK_PAY
    ? bankaLink(p.pay_amount, `${p.first_name} ${p.last_name} · DRUID BATTLE CUP`)
    : '';
  const isVol = p?.kind === 'volunteer';
  const initials = p ? ((p.first_name[0] ?? '') + (p.last_name[0] ?? '')).toUpperCase() : '';

  return (
    <main className="jn-root"><div className="jn-wrap wide">
      {/* Навігація двіжу — кабінет живе всередині системи, не окремо */}
      <LigaNav />

      {state === 'loading' && <LigaLoader label="Відкриваю кабінет…" skeleton />}

      {state === 'not_found' && (
        <>
          <h1 className="jn-h1">Невідомий лінк</h1>
          <p className="jn-lead">За цим токеном нікого не знайдено — можливо, лінк скопійований не повністю.</p>
          <a className="jn-btn" href="/join">Зареєструватись →</a>
        </>
      )}

      {state === 'error' && (
        <>
          <h1 className="jn-h1">Щось зі звʼязком</h1>
          <p className="jn-lead">Не вдалося завантажити дані.</p>
          <button className="jn-btn cyan" onClick={() => { setState('loading'); load(); }}>Спробувати ще раз</button>
        </>
      )}

      {state === 'ok' && p && (
        <>
          {/* Шапка профілю: банер локації + аватар + статус */}
          <header className="jn-phead">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="jn-phead-bg" src="/v2/bg/druid-evening.jpg" alt="" />
            <div className="jn-phead-in">
              <div className="jn-ava">{initials}</div>
              <div className="jn-phead-who">
                <h1>{isVol ? p.first_name : (p.nick || p.first_name)}</h1>
                <p>{p.first_name} {p.last_name} · {p.telegram}</p>
                <div className="jn-chips">
                  {!isVol && <span className="jn-chip yellow">{LEVEL_LABEL[p.level] ?? p.level}</span>}
                  {p.is_sportik && <span className="jn-chip pink">Спортик</span>}
                  {(isVol || p.volunteer) && <span className="jn-chip lime">Волонтер 🙌</span>}
                  {!isVol && (p.paid
                    ? <span className="jn-chip lime">✅ У лізі</span>
                    : <span className="jn-chip">⏳ Не оплачено</span>)}
                </div>
              </div>
            </div>
          </header>
          {isLocal && (
            <p className="jn-hint" style={{ fontWeight: 700 }}>🧪 Тестовий режим: запис живе тільки на цьому телефоні.</p>
          )}

          {/* Каундаун — головний акцент */}
          <div className="jn-card jn-count">
            <p className="jn-count-label">Граємо на ДРУЇДІ · жеребкування —</p>
            <div className="jn-count-big">
              {cd ? <>{cd.days} <small>дн</small> {cd.hours} <small>год</small></> : 'вже скоро!'}
            </div>
            <p className="jn-hint" style={{ margin: 0 }}>
              2 серпня система розкидає пари → 21 день ліги → фінали Дня Х <b>23 серпня</b>.
            </p>
          </div>

          <div className="jn-grid">
            <div>
              {isVol ? (
                <div className="jn-card">
                  <h3>Волонтерство · День Х</h3>
                  <div className="jn-status"><span className="ico">🙌</span> Ти в команді 23 серпня!</div>
                  {p.volunteer_roles.length > 0 && <p className="jn-hint">Поможеш: {p.volunteer_roles.join(' · ')}</p>}
                  <p className="jn-hint">Монтаж з 11:00, відкриття о 12:00. Деталі — в телеграм. Оплата не потрібна.</p>
                </div>
              ) : (
                <div className="jn-card">
                  <h3 style={{ marginBottom: 4 }}>Мої матчі · 0/8</h3>
                  <p style={{ margin: '0 0 10px' }}><span className="jn-chip yellow">🎲 жеребкування — 2.08</span></p>
                  <div className="jn-matches">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div className="jn-match" key={i}>
                        <span className="n">{i + 1}</span>
                        <span className="vs">суперник — після жеребкування 2.08</span>
                        <span className="res">— : —</span>
                      </div>
                    ))}
                  </div>
                  <p className="jn-hint" style={{ marginTop: 10 }}>
                    Тут зʼявляться твої пари, контакти суперників і рахунки.
                  </p>
                </div>
              )}
            </div>

            <div>
              {!isVol && !p.paid && (
                <div className="jn-card">
                  <h3>Оплата · {p.pay_amount} грн {MOCK_PAY && <span style={{ fontWeight: 600 }}>🧪</span>}</h3>
                  {MOCK_PAY ? (
                    <>
                      {!p.paid_claimed_at && (
                        <button className="jn-btn" style={{ marginTop: 6 }} disabled={claiming} onClick={payAction}>
                          {claiming ? '…' : '💳 Оплатити · імітація'}
                        </button>
                      )}
                      {p.paid_claimed_at && !p.paid && (
                        <p className="jn-hint" style={{ fontWeight: 800, margin: 0 }}>🟡 Позначено (тест) — орг підтвердить.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="jn-hint" style={{ marginTop: 0 }}>Банка → скріншот у Telegram → ти в лізі.</p>
                      <a className="jn-btn" href={banka} target="_blank" rel="noreferrer">💳 Банка · {p.pay_amount} грн</a>
                      {TG_CONFIRM_URL && <a className="jn-btn cyan" href={TG_CONFIRM_URL} target="_blank" rel="noreferrer">📸 Скріншот у Telegram</a>}
                    </>
                  )}
                </div>
              )}

              <div className="jn-card">
                <h3>Швидкі лінки</h3>
                <div className="jn-links">
                  <Link href="/pravyla">📜 Правила ліги</Link>
                  <Link href="/standings">📊 Сітка і рейтинг</Link>
                  <Link href="/players">🃏 Гравці</Link>
                  <a href="https://ttcup-onboard.vercel.app">🎬 Що за двіж</a>
                </div>
              </div>

              {!isVol && p.volunteer && p.volunteer_roles.length > 0 && (
                <div className="jn-card">
                  <h3>Волонтерство 🙌</h3>
                  <p className="jn-hint" style={{ margin: 0 }}>Поможеш: {p.volunteer_roles.join(' · ')}</p>
                </div>
              )}
            </div>
          </div>

          <p className="jn-hint">Це твій особистий лінк-вхід. Збережи його — паролів у нас нема.</p>
        </>
      )}
    </div></main>
  );
}

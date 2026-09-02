'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LigaNav from '@/components/liga/LigaNav';
import GoogleButton from '@/components/liga/GoogleButton';
import { GOOGLE_AUTH_ENABLED, supaBrowser } from '@/lib/ligaAuth';
import {
  bankaLink, MOCK_PAY, TG_CONFIRM_URL, levelFromAnswers, LEVEL_LABEL,
  QUESTIONS, VOLUNTEER_ROLES,
} from '@/lib/liga';

/**
 * Реєстрація ліги (D-035/D-036):
 *  · анкета рівня — 7 питань СТЕПАМИ (по одному на екран, автоперехід);
 *  · «просто волонтерити» — тихий лінк, не кнопка в потоці (чек у анкеті лишається);
 *  · тарифи 420/840 розведені якісно (ілюстрації, преміум-акцент);
 *  · оплата: банка + СКРІНШОТ у Telegram (без кодів); поки банки нема — імітація;
 *  · база не мігрована → повна локальна імітація (localStorage, /turnir/dbc/local).
 */

const ERR: Record<string, string> = {
  nick_taken: 'Такий нік уже зайнятий — вигадай інший',
  timeout: 'Звʼязок повільний, спробуй ще раз',
};

type Mode = 'player' | 'volunteer';

export default function JoinPage() {
  const [mode, setMode] = useState<Mode>('player');
  const [step, setStep] = useState(1);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(QUESTIONS.length).fill(null));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nick, setNick] = useState('');
  const [telegram, setTelegram] = useState('');
  const [volunteer, setVolunteer] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [amount, setAmount] = useState<420 | 840>(420);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ token: string; kind: Mode; mock?: boolean } | null>(null);
  const [payState, setPayState] = useState<'none' | 'claimed' | 'paid'>('none');
  const [existing, setExisting] = useState('');

  // D-047: авторизація обовʼязкова — як у будь-якому продукті.
  const [authed, setAuthed] = useState<'checking' | 'no' | 'yes'>(GOOGLE_AUTH_ENABLED ? 'checking' : 'yes');

  useEffect(() => {
    try { setExisting(localStorage.getItem('dbc_token') || ''); } catch { /* приватний режим */ }
    if (!GOOGLE_AUTH_ENABLED) return;
    supaBrowser().auth.getSession().then(({ data: { session } }) => {
      if (!session) { setAuthed('no'); return; }
      const full = ((session.user.user_metadata as { full_name?: string }).full_name ?? '').trim();
      if (full) {
        const [fn, ...rest] = full.split(/\s+/);
        setFirstName((v) => v || fn);
        setLastName((v) => v || rest.join(' '));
      }
      setAuthed('yes');
    });
  }, []);

  const allAnswered = answers.every((a) => a !== null);
  const { level } = levelFromAnswers(answers.map((a) => a ?? 0));

  function pickAnswer(oi: number) {
    setAnswers((p) => p.map((v, i) => (i === qIdx ? oi : v)));
    // автоперехід на наступне питання — степи, а не довгий опросник
    setTimeout(() => {
      setQIdx((q) => {
        if (q < QUESTIONS.length - 1) return q + 1;
        setStep(2);
        return q;
      });
    }, 260);
  }

  function validateBasics(needNick: boolean): string {
    if (!firstName.trim() || !lastName.trim()) return 'Імʼя і прізвище — обовʼязкові';
    if (needNick && !nick.trim()) return 'Нік — як тебе показувати в рейтингу';
    if (telegram.trim().length < 3) return 'Телеграм потрібен — там усі домовленості';
    return '';
  }

  function mockRegister(kind: Mode) {
    const rec = {
      kind, firstName: firstName.trim(), lastName: lastName.trim(), nick: nick.trim(),
      telegram: telegram.trim(), level, volunteer: kind === 'volunteer' || volunteer, roles,
      amount: kind === 'volunteer' ? 0 : amount, payCode: 'TEST', status: 'new',
      createdAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('dbc_mock', JSON.stringify(rec));
      localStorage.setItem('dbc_token', 'local');
    } catch { /* ок */ }
    setDone({ token: 'local', kind, mock: true });
  }

  async function submit(kind: Mode) {
    setErr('');
    const v = validateBasics(kind === 'player');
    if (v) { setErr(v); return; }
    setBusy(true);
    try {
      let accessToken: string | undefined;
      if (GOOGLE_AUTH_ENABLED) {
        const { data: { session } } = await supaBrowser().auth.getSession();
        accessToken = session?.access_token;
      }
      const r = await fetch('/api/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind, firstName: firstName.trim(), lastName: lastName.trim(), nick: nick.trim(),
          telegram: telegram.trim(), answers, volunteer: kind === 'volunteer' || volunteer, roles,
          amount, access_token: accessToken,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data.error === 'db_not_ready') { mockRegister(kind); return; }
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      try { localStorage.setItem('dbc_token', data.token); } catch { /* ок */ }
      if (data.already) { location.href = `/turnir/dbc/${data.token}`; return; }
      setDone({ token: data.token, kind });
    } catch (e) {
      const m = (e as Error).message;
      setErr(ERR[m] || 'Не вийшло: ' + m);
    } finally { setBusy(false); }
  }

  function mockPay() {
    if (!done) return;
    if (done.mock) {
      try {
        const rec = JSON.parse(localStorage.getItem('dbc_mock') || '{}');
        rec.status = 'paid';
        localStorage.setItem('dbc_mock', JSON.stringify(rec));
      } catch { /* ок */ }
      setPayState('paid');
    } else {
      fetch(`/api/ya/${done.token}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'claim_paid' }),
      }).catch(() => {});
      setPayState('claimed');
    }
    // оплатив → саме перекидає в кабінет (D-040), тиснути нічого не треба
    setTimeout(() => { location.href = `/turnir/dbc/${done.token}`; }, 1400);
  }

  const banka = done && !MOCK_PAY
    ? bankaLink(amount, `${firstName.trim()} ${lastName.trim()} · DRUID BATTLE CUP`)
    : '';

  // ---------- Авторизація — перші двері (D-047) ----------
  if (authed !== 'yes') {
    return (
      <main className="jn-root"><div className="jn-wrap">
        <LigaNav />
        <p className="jn-step">реєстрація в лігу</p>
        <h1 className="jn-h1">Спершу — вхід</h1>
        {authed === 'checking' ? (
          <p className="jn-lead">Секунду…</p>
        ) : (
          <>
            <p className="jn-lead">
              Твоя заявка, оплата і матчі живуть у твоєму акаунті — тому реєстрація починається зі входу.
            </p>
            <GoogleButton />
            <p className="jn-hint">Після входу повернешся сюди — анкета на 2 хвилини.</p>
          </>
        )}
      </div></main>
    );
  }

  // ---------- Пост-екран ----------
  if (done) {
    const isVol = done.kind === 'volunteer';
    return (
      <main className="jn-root"><div className="jn-wrap">
        <LigaNav />
        {isVol ? (
          <>
            <h1 className="jn-h1">Ти в команді! 🙌</h1>
            <p className="jn-lead">Дякуємо! Напишемо тобі в телеграм ближче до Дня Х — розкидаємо ролі й деталі.</p>
            {done.mock && <p className="jn-hint" style={{ fontWeight: 700 }}>🧪 Тестовий режим: запис локальний, база ще готується.</p>}
          </>
        ) : (
          <>
            <h1 className="jn-h1">Ти в грі! 🏓</h1>
            <p className="jn-lead">Лишилась оплата участі — <b>{amount} грн</b>.</p>
            <div className="jn-card">
              {MOCK_PAY ? (
                <>
                  <p className="jn-hint">🧪 <b>Тестовий режим:</b> банки ще нема, кнопка нижче — імітація оплати.</p>
                  {payState === 'none' && <button className="jn-btn" onClick={mockPay}>💳 Оплатити · імітація</button>}
                  {payState === 'claimed' && <p className="jn-hint" style={{ fontWeight: 800 }}>🟡 Позначено (тест). Далі орг підтверджує — як у бойовому флоу.</p>}
                  {payState === 'paid' && <p className="jn-hint" style={{ fontWeight: 800 }}>✅ «Оплачено» (імітація). Флоу пройдено до кінця.</p>}
                </>
              ) : (
                <>
                  <p className="jn-hint" style={{ marginTop: 0 }}>
                    1️⃣ Закинь <b>{amount} грн</b> на банку →<br />
                    2️⃣ Кинь <b>скріншот переказу</b> нам у телеграм — і ми відкриваємо тобі лігу.
                  </p>
                  <a className="jn-btn" href={banka} target="_blank" rel="noreferrer">💳 Відкрити банку · {amount} грн</a>
                  {TG_CONFIRM_URL
                    ? <a className="jn-btn cyan" href={TG_CONFIRM_URL} target="_blank" rel="noreferrer">📸 Надіслати скріншот у Telegram</a>
                    : <p className="jn-hint" style={{ fontWeight: 700 }}>📸 Скріншот кинь оргам у Telegram — лінк зʼявиться тут.</p>}
                </>
              )}
            </div>
          </>
        )}
        <Link className="jn-btn ghost" href={`/turnir/dbc/${done.token}`}>🏆 Мій турнір →</Link>
        <p className="jn-hint">Твій вхід — акаунт Google: заходь у «Мій турнір» з будь-якого пристрою.</p>
      </div></main>
    );
  }

  // ---------- Волонтерський флоу ----------
  if (mode === 'volunteer') {
    return (
      <main className="jn-root"><div className="jn-wrap">
        <LigaNav />
        <p className="jn-step">волонтерство · без оплати</p>
        <h1 className="jn-h1">Стати волонтером 🙌</h1>
        <p className="jn-lead">День Х — 13 вересня на ДРУЇДІ. Обери, чим готовий помогти.</p>
        <div className="jn-field"><label>Імʼя</label>
          <input className="jn-input" maxLength={40} placeholder="Олена" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="jn-field"><label>Прізвище</label>
          <input className="jn-input" maxLength={40} placeholder="Сітка" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div className="jn-field"><label>Телеграм</label>
          <input className="jn-input" maxLength={40} placeholder="@nick" value={telegram} onChange={(e) => setTelegram(e.target.value)} /></div>
        <div className="jn-roles" style={{ marginTop: 4 }}>
          {VOLUNTEER_ROLES.map((r) => (
            <button key={r} className={'jn-role' + (roles.includes(r) ? ' on' : '')}
              onClick={() => setRoles((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))}>
              {r}
            </button>
          ))}
        </div>
        <button className="jn-btn" disabled={busy} onClick={() => submit('volunteer')}>
          {busy ? 'Записую…' : '🙌 Записатись у волонтери'}
        </button>
        <button className="jn-btn ghost" onClick={() => { setErr(''); setMode('player'); }}>← Я все ж пограю</button>
        {err && <p className="jn-err">{err}</p>}
      </div></main>
    );
  }

  // ---------- Гравецький флоу ----------
  return (
    <main className="jn-root"><div className="jn-wrap">
      <LigaNav />

      {existing && (
        <div className="jn-card" style={{ background: '#eafff0' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
            Ти вже реєструвався з цього телефона. <Link href={`/turnir/dbc/${existing}`} style={{ color: 'var(--blue)' }}>Мій турнір →</Link>
          </p>
        </div>
      )}

      <div className="jn-dots" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={'jn-dot' + (i === step ? ' on' : i < step ? ' done' : '')} />
        ))}
      </div>

      {step === 1 && (
        <>
          <p className="jn-step">Крок 1/3 · рівень · питання {qIdx + 1}/{QUESTIONS.length}</p>
          <h1 className="jn-h1">{QUESTIONS[qIdx].q}</h1>
          <p className="jn-lead">Чесність = суперники тобі під силу. Рівень видно перед матчем.</p>
          <div className="jn-opts">
            {QUESTIONS[qIdx].opts.map((o, oi) => (
              <button
                key={oi}
                className={'jn-opt' + (answers[qIdx] === oi ? ' on' : '')}
                onClick={() => pickAnswer(oi)}
              >{o}</button>
            ))}
          </div>
          <div className="jn-qnav">
            {qIdx > 0 && <button className="jn-btn ghost" onClick={() => setQIdx(qIdx - 1)}>← Назад</button>}
            {allAnswered && (
              <button className="jn-btn" onClick={() => { setErr(''); setStep(2); }}>
                Далі → рівень: {LEVEL_LABEL[level]}
              </button>
            )}
          </div>
          <p className="jn-vollink">
            Не граєш, а хочеш помогти? <button onClick={() => { setErr(''); setMode('volunteer'); }}>Стати волонтером 🙌</button>
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <p className="jn-step">Крок 2/3 · хто ти</p>
          <h1 className="jn-h1">Як тебе звати?</h1>
          <p className="jn-lead">Нік побачать усі в рейтингу, телеграм — тільки суперники, щоб домовитись про матч.</p>
          <div className="jn-field"><label>Імʼя</label>
            <input className="jn-input" maxLength={40} placeholder="Олег" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="jn-field"><label>Прізвище</label>
            <input className="jn-input" maxLength={40} placeholder="Ракетка" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="jn-field"><label>Нік у рейтингу</label>
            <input className="jn-input" maxLength={24} placeholder="TOPSPIN_OLEG" value={nick} onChange={(e) => setNick(e.target.value)} /></div>
          <div className="jn-field"><label>Телеграм</label>
            <input className="jn-input" maxLength={40} placeholder="@nick" value={telegram} onChange={(e) => setTelegram(e.target.value)} /></div>

          <button className={'jn-check' + (volunteer ? ' on' : '')} onClick={() => setVolunteer((v) => !v)}>
            <span className="box">{volunteer ? '✓' : ''}</span>
            Ще й поволонтерю в день Х 🙌
          </button>
          {volunteer && (
            <div className="jn-roles">
              {VOLUNTEER_ROLES.map((r) => (
                <button key={r} className={'jn-role' + (roles.includes(r) ? ' on' : '')}
                  onClick={() => setRoles((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))}>
                  {r}
                </button>
              ))}
            </div>
          )}

          <button className="jn-btn" onClick={() => {
            setErr('');
            const v = validateBasics(true);
            if (v) { setErr(v); return; }
            setStep(3);
          }}>Далі →</button>
          <button className="jn-btn ghost" onClick={() => setStep(1)}>← Назад</button>
          {err && <p className="jn-err">{err}</p>}
        </>
      )}

      {step === 3 && (
        <>
          <p className="jn-step">Крок 3/3 · участь</p>
          <h1 className="jn-h1">Оплата участі</h1>
          <p className="jn-lead">Ліга 7–12 вересня + День Х 13 вересня з фіналами і міні-іграми. Все на ДРУЇДІ.</p>
          <div className="jn-prices">
            <button className={'jn-price' + (amount === 420 ? ' on' : '')} onClick={() => setAmount(420)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="jn-price-art" src="/v2/vars/02.png" alt="" />
              <div className="jn-price-body">
                <div className="sum">420 грн</div>
                <div className="what">УЧАСНИК</div>
                <div className="note">✔ 8 матчів ліги · ✔ День Х і фінали · ✔ міні-ігри · ✔ залік на призи</div>
              </div>
            </button>
            <button className={'jn-price prem' + (amount === 840 ? ' on' : '')} onClick={() => setAmount(840)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="jn-price-art" src="/v2/vars/04.png" alt="" />
              <div className="jn-price-body">
                <div className="sum">840 грн</div>
                <div className="what">ЛЕГЕНДА ДВІЖУ ⭐</div>
                <div className="note">Все з «Учасника» + твій внесок у призовий фонд і фан-станції · імʼя в титрах Дня Х · гучна дяка зі сцени</div>
              </div>
            </button>
          </div>
          {MOCK_PAY && <p className="jn-hint">🧪 Оплата зараз у тестовому режимі (імітація) — гроші не рухаються.</p>}
          <button className="jn-btn" disabled={busy} onClick={() => submit('player')}>
            {busy ? 'Реєструю…' : `Зареєструватись · ${amount} грн`}
          </button>
          <button className="jn-btn ghost" onClick={() => setStep(2)}>← Назад</button>
          {err && <p className="jn-err">{err}</p>}
        </>
      )}
    </div></main>
  );
}

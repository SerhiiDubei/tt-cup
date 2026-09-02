'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { LEVEL_LABEL } from '@/lib/liga';

type Player = {
  num: number; kind: 'player' | 'volunteer';
  first_name: string; last_name: string; nick: string | null;
  telegram: string | null; instagram?: string | null; phone?: string | null;
  level: number; is_sportik: boolean; volunteer: boolean; volunteer_roles: string[];
  pay_amount: number; paid: boolean; paid_claimed_at: string | null; created_at: string;
  payCode: string; googleLinked?: boolean;
};

/* Ключові дати турніру — єдине джерело для фази кабінету. */
const REG_END = new Date('2026-09-06T23:59:59+03:00'); // реєстрація закривається
const DRAW = REG_END;                                  // жеребкування одразу після
const LEAGUE_END = new Date('2026-09-12T23:59:59+03:00');
const DAY_X = new Date('2026-09-13T00:00:00+03:00');
const DAY_X_END = new Date('2026-09-13T23:59:59+03:00');

type Phase = 'before' | 'league' | 'dayx' | 'after';
function phaseNow(now: Date): Phase {
  if (now < DRAW) return 'before';
  if (now <= LEAGUE_END) return 'league';
  if (now >= DAY_X && now <= DAY_X_END) return 'dayx';
  return 'after';
}

const TG = 'https://t.me/bomberman047';
const SLOTS = 8;

/** Відлік до закриття реєстрації. Оновлюється щохвилини — секунди тут зайвий шум. */
function Countdown({ to }: { to: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const left = to.getTime() - now;
  if (left <= 0) return (
    <div className="kb-cd over"><div><b>0</b><span>реєстрацію закрито</span></div></div>
  );
  const d = Math.floor(left / 86400000);
  const h = Math.floor(left / 3600000) % 24;
  const m = Math.floor(left / 60000) % 60;
  return (
    <div className="kb-cd">
      <div><b>{d}</b><span>{plural(d, 'день', 'дні', 'днів')}</span></div>
      <div><b>{String(h).padStart(2, '0')}</b><span>{plural(h, 'година', 'години', 'годин')}</span></div>
      <div><b>{String(m).padStart(2, '0')}</b><span>{plural(m, 'хвилина', 'хвилини', 'хвилин')}</span></div>
    </div>
  );
}
function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** Вісім слотів суперників. До жеребкування — знаки питання. */
function Slots({ opponents }: { opponents: string[] }) {
  return (
    <div className="kb-slots">
      <div className="kb-lbl">ТВОЇ СУПЕРНИКИ · {opponents.length}/{SLOTS}</div>
      <div className="kb-grid">
        {Array.from({ length: SLOTS }, (_, i) => (
          opponents[i]
            ? <div key={i} className="kb-slot filled">{opponents[i]}</div>
            : <div key={i} className="kb-slot" aria-label="ще невідомо">?</div>
        ))}
      </div>
      <p>Вісім матчів із різними людьми. Жереб зведе пари, щойно закриється реєстрація.</p>
    </div>
  );
}

/**
 * КАБІНЕТ УЧАСНИКА — переписаний (див. Claude Design «DBC — кабінет учасника»).
 * Одна робота: відповісти на «що мені робити далі і коли» за три секунди.
 * Один головний стан угорі, рівно одна головна дія, решта — під межею.
 * Неоплачений внесок має пріоритет над фазою: це єдине, що вимагає участі.
 */
export default function KabinetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<Player | null>(null);
  const [state, setState] = useState<'load' | 'ok' | 'missing' | 'error'>('load');

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/ya/${token}`, { cache: 'no-store' });
      if (r.status === 404) { setState('missing'); return; }
      if (!r.ok) { setState('error'); return; }
      const j = await r.json();
      setP(j.player); setState('ok');
      try { localStorage.setItem('dbc_token', token); } catch { /* приватний режим */ }
    } catch { setState('error'); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (state === 'load') return <Shell><div className="kb-msg">Завантажую…</div></Shell>;
  if (state === 'missing') return (
    <Shell><div className="kb-msg"><b>ТАКОГО ЗАПИСУ НЕМАЄ</b>
      Схоже, посилання неповне або застаріле. Напиши — розберемось.
      <div className="kb-act" style={{ padding: '20px 0 0' }}>
        <a className="kb-btn" href={TG}>НАПИСАТИ ОРГАНІЗАТОРУ</a>
      </div></div></Shell>
  );
  if (state === 'error' || !p) return (
    <Shell><div className="kb-msg"><b>ЗВʼЯЗОК ПРОПАВ</b>
      Не вдалося завантажити дані.
      <div className="kb-act" style={{ padding: '20px 0 0' }}>
        <button className="kb-btn" onClick={() => { setState('load'); void load(); }}>СПРОБУВАТИ ЩЕ РАЗ</button>
      </div></div></Shell>
  );

  const phase = phaseNow(new Date());
  const name = p.nick || p.first_name || 'Гравець';
  const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
  const contact = p.telegram || (p.instagram ? '@' + p.instagram + ' · IG' : '—');

  /* Головний блок. Неоплата перебиває фазу — інакше людина не знає, що від неї чекають. */
  let lbl: string, big: string, sub: React.ReactNode, calm = false;
  let action: React.ReactNode = null;

  if (phase === 'before') {
    lbl = 'ДО КІНЦЯ РЕЄСТРАЦІЇ'; calm = true;
    big = 'ТИ В СПИСКУ';
    sub = <>Реєстрація закривається <em>6 вересня о 23:59</em>. Одразу після цього жереб зведе пари.</>;
    action = <a className="kb-btn ghost" href="/pravyla">Як усе влаштовано →</a>;
  } else if (phase === 'league') {
    lbl = 'ЛІГА ЙДЕ'; calm = true;
    big = 'ГРАЄМО ДО 12.09';
    sub = <>Пари вже розкидані. Домовляйся про матчі й грай — час і місце обираєте самі. Список суперників надішле організатор.</>;
    action = <a className="kb-btn" href={TG}>ДЕ МОЇ ПАРИ?</a>;
  } else if (phase === 'dayx') {
    lbl = 'СЬОГОДНІ · ДЕНЬ Х'; calm = false;
    big = '13 ВЕРЕСНЯ · ДРУЇД';
    sub = <>Фінали, ФАН-частина о <em>13:00</em>, нагородження о <em>17:45</em>, афтепаті о <em>18:30</em>.</>;
    action = <a className="kb-btn ghost" href="/pravyla">Розклад дня →</a>;
  } else {
    lbl = 'ТУРНІР ЗАВЕРШЕНО'; calm = true;
    big = 'ДЯКУЄМО ЗА ГРУ';
    sub = <>Наступний DRUID BATTLE CUP — скоро. Напишу, щойно відкриємо запис.</>;
    action = <a className="kb-btn ghost" href={TG}>Написати організатору</a>;
  }

  return (
    <Shell>
      <div className="kb-hd">
        <div className="kb-ava" aria-hidden>{initials}</div>
        <div className="kb-who">
          <b>{name.toUpperCase()}</b>
          <span>{LEVEL_LABEL[p.level] ?? '—'}{p.is_sportik ? ' · розрядник' : ''}</span>
        </div>
        <div className="kb-num">№{p.num}</div>
      </div>

      <div className="kb-now">
        <div className="kb-lbl">{lbl}</div>
        <div className={'kb-big' + (calm ? ' calm' : '')}>{big}</div>
        <p className="kb-sub">{sub}</p>
        {phase === 'before' && <Countdown to={REG_END} />}
      </div>

      <div className="kb-act">{action}</div>

      {p.kind === 'player' && (phase === 'before' || phase === 'league') && <Slots opponents={[]} />}

      <div className="kb-rest">
        <div className="kb-row"><span>Внесок</span>
          <b className={p.paid ? 'ok' : ''}>
            {p.pay_amount} грн{p.paid ? ' · підтверджено' : ''}
          </b>
        </div>
        <div className="kb-row"><span>Твій контакт</span><b>{contact}</b></div>
        {p.volunteer && p.volunteer_roles.length > 0 && (
          <div className="kb-row"><span>Волонтериш</span><b>{p.volunteer_roles.join(', ')}</b></div>
        )}
      </div>
      <div className="kb-note">Посилання на цю сторінку — твій вхід. Збережи його.</div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="kb-root"><div className="kb-phone">{children}</div></div>;
}

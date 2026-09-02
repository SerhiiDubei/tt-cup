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
const DRAW = new Date('2026-09-05T23:59:59+03:00');   // жеребкування
const LEAGUE_END = new Date('2026-09-11T23:59:59+03:00');
const DAY_X = new Date('2026-09-12T00:00:00+03:00');
const DAY_X_END = new Date('2026-09-12T23:59:59+03:00');

type Phase = 'before' | 'league' | 'dayx' | 'after';
function phaseNow(now: Date): Phase {
  if (now < DRAW) return 'before';
  if (now <= LEAGUE_END) return 'league';
  if (now >= DAY_X && now <= DAY_X_END) return 'dayx';
  return 'after';
}

const TG = 'https://t.me/bomberman047';

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
  const [claiming, setClaiming] = useState(false);

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

  async function claimPaid() {
    setClaiming(true);
    try {
      const r = await fetch(`/api/ya/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_paid' }),
      });
      if (r.ok) { const j = await r.json(); setP(j.player); }
    } finally { setClaiming(false); }
  }

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
  const needsPay = p.kind === 'player' && !p.paid;
  const claimed = !!p.paid_claimed_at;
  const name = p.nick || p.first_name || 'Гравець';
  const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
  const contact = p.telegram || (p.instagram ? '@' + p.instagram + ' · IG' : '—');

  /* Головний блок. Неоплата перебиває фазу — інакше людина не знає, що від неї чекають. */
  let lbl: string, big: string, sub: React.ReactNode, calm = false;
  let action: React.ReactNode = null;

  if (needsPay) {
    lbl = 'ПОТРІБНА ДІЯ';
    big = claimed ? 'ЧЕКАЄМО ПІДТВЕРДЖЕННЯ' : 'ВНЕСОК ЩЕ НЕ ПІДТВЕРДЖЕНО';
    sub = claimed
      ? <>Ти позначив оплату — організатор звірить і підтвердить вручну. Це не миттєво.</>
      : <>Місце тримаємо до <em>5 вересня</em>. Після цього воно піде наступному в черзі.</>;
    action = claimed
      ? <a className="kb-btn ghost" href={TG}>Написати організатору</a>
      : <>
          <button className="kb-btn warn" onClick={claimPaid} disabled={claiming}>
            {claiming ? 'ЗБЕРІГАЮ…' : `Я ОПЛАТИВ ${p.pay_amount} ГРН`}
          </button>
          <a className="kb-btn ghost" href={TG}>Питання про оплату</a>
        </>;
  } else if (phase === 'before') {
    lbl = 'ЩО ЗАРАЗ'; calm = true;
    big = 'ТИ В СПИСКУ';
    sub = <>Жеребкування — <em>5 вересня</em>. Щойно система розкидає пари, суперники зʼявляться тут.</>;
    action = <a className="kb-btn ghost" href="/pravyla">Як усе влаштовано →</a>;
  } else if (phase === 'league') {
    lbl = 'ЛІГА ЙДЕ'; calm = true;
    big = 'ГРАЄМО ДО 11.09';
    sub = <>Пари вже розкидані. Домовляйся про матчі й грай — час і місце обираєте самі. Список суперників надішле організатор.</>;
    action = <a className="kb-btn" href={TG}>ДЕ МОЇ ПАРИ?</a>;
  } else if (phase === 'dayx') {
    lbl = 'СЬОГОДНІ · ДЕНЬ Х'; calm = false;
    big = '12 ВЕРЕСНЯ · ДРУЇД';
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
      </div>

      <div className="kb-act">{action}</div>

      <div className="kb-rest">
        <div className="kb-row"><span>Внесок</span>
          <b className={p.paid ? 'ok' : 'warn'}>
            {p.pay_amount} грн · {p.paid ? 'підтверджено' : claimed ? 'на перевірці' : 'чекає'}
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

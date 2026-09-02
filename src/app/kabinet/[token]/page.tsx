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

/** Мʼяч зі знаком питання, намальований піксель-сіткою 10×10 —
    щоб порожній слот виглядав як частина світу, а не як гліф зі шрифту. */
function UnknownIcon() {
  const Q = [
    [3,1],[4,1],[5,1],[6,1],
    [2,2],[7,2],
    [6,3],[7,3],
    [5,4],[6,4],
    [4,5],[5,5],
    [4,6],
    [4,8],
  ];
  return (
    <svg viewBox="0 0 10 10" role="img" aria-label="суперник ще невідомий" shapeRendering="crispEdges">
      <g className="px-ball">
        <rect x="3" y="0" width="4" height="1" /><rect x="1" y="1" width="8" height="1" />
        <rect x="0" y="2" width="10" height="6" /><rect x="1" y="8" width="8" height="1" />
        <rect x="3" y="9" width="4" height="1" />
      </g>
      <g className="px-q">
        {Q.map(([x, y], i) => <rect key={i} x={x} y={y} width="1" height="1" />)}
      </g>
    </svg>
  );
}

/** Аватар із ніка: детерміноване піксельне поле 5×5, дзеркальне по вертикалі.
    Однаковий нік завжди дає однакову картинку, файлів не потрібно. */
function seedOf(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const AV_INK = [
  '#FFC619', '#F26F21', '#7AC36A', '#4FA3E3', '#E8765A', '#B98BE0',
  '#00CFC1', '#FF2E88', '#A6E22E', '#FF8A2A', '#8A45FF', '#5AD1E8',
];
function Avatar({ nick }: { nick: string }) {
  const seed = seedOf(nick);
  // колір беремо з верхніх бітів, а візерунок — з нижніх, щоб два ніки
  // не збігалися й кольором, і формою одночасно
  const main = AV_INK[(seed >>> 20) % AV_INK.length];
  const alt = AV_INK[((seed >>> 8) + 5) % AV_INK.length];
  const a: React.ReactNode[] = [];
  const b: React.ReactNode[] = [];
  let bits = seed ^ 0x9e3779b9;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      bits = Math.imul(bits, 1103515245) + 12345;
      const v = (bits >>> 16) & 7;
      if (v < 2) continue;                       // ~25% порожніх
      const arr = v > 5 ? b : a;                 // ~25% другим кольором
      arr.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
      if (x < 2) arr.push(<rect key={`m${x}-${y}`} x={4 - x} y={y} width="1" height="1" />);
    }
  }
  return (
    <svg className="av" viewBox="0 0 5 5" shapeRendering="crispEdges" role="img" aria-label={`аватар ${nick}`}>
      <rect x="0" y="0" width="5" height="5" fill="#241B12" />
      <g fill={main}>{a}</g>
      <g fill={alt}>{b}</g>
    </svg>
  );
}

/** Склад турніру: 32 місця однією стрічкою. Зайняті — з ніком і аватаром,
    вільні — піксельним мʼячем зі знаком питання. */
function Roster({ meNum }: { meNum: number }) {
  const [data, setData] = useState<{ players: { num: number; nick: string }[]; total: number; taken: number } | null>(null);
  useEffect(() => {
    fetch('/api/players', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
  }, []);
  const total = data?.total ?? 32;
  const taken = data?.taken ?? 0;
  const byNum = new Map((data?.players ?? []).map((p) => [p.num, p]));
  const seats = Array.from({ length: total }, (_, i) => byNum.get(i + 1) ?? null);
  return (
    <div className="kb-roster">
      <div className="kb-roster-hd">
        <div className="kb-lbl">СКЛАД ТУРНІРУ</div>
        <div className="kb-count">{taken}<span>/{total}</span></div>
      </div>
      <div className="kb-bar"><i style={{ width: `${Math.round((taken / total) * 100)}%` }} /></div>
      <div className="kb-strip">
        {seats.map((p, i) => p ? (
          <div key={i} className={'kb-seat' + (p.num === meNum ? ' me' : '')}>
            <Avatar nick={p.nick} />
            <b>{p.nick}</b><i>№{p.num}</i>
          </div>
        ) : (
          <div key={i} className="kb-seat free">
            <div className="av kb-slot"><UnknownIcon /></div>
            <b>вільне</b><i>—</i>
          </div>
        ))}
      </div>
      <p>{taken < total
        ? `Лишилось ${total - taken} ${total - taken === 1 ? 'місце' : (total - taken) < 5 ? 'місця' : 'місць'}. Гортай убік — там усі.`
        : 'Усі місця зайняті.'}</p>
    </div>
  );
}

/** Календар турніру: де ми зараз. Сітка збігається з тією, що в чаті —
    31.08 понеділок, тож два рівні ряди: реєстрація 1–6, матчі 7–12, фінал 13. */
function Calendar({ now }: { now: Date }) {
  const today = now.getFullYear() === 2026 && now.getMonth() === 8 ? now.getDate() : 0;
  const days: { n: number; cls: string }[] = [{ n: 31, cls: 'mute' }];
  for (let d = 1; d <= 13; d++) {
    days.push({ n: d, cls: d <= 6 ? 'reg' : d <= 12 ? 'onl' : 'main' });
  }
  const note = today === 0 ? null
    : today <= 6 ? <>Сьогодні <em>{today} вересня</em> — реєстрація ще відкрита.</>
    : today <= 12 ? <>Сьогодні <em>{today} вересня</em> — час грати свої матчі.</>
    : today === 13 ? <>Сьогодні <em>День Х</em>. Побачимось на Друїді.</>
    : null;
  return (
    <div className="kb-cal">
      <div className="kb-lbl">ВЕРЕСЕНЬ · ДЕ МИ ЗАРАЗ</div>
      <div className="kb-days">
        {['пн','вт','ср','чт','пт','сб','нд'].map((w) => <div key={w} className="kb-wd">{w}</div>)}
        {days.map((d) => {
          const isToday = d.n === today && d.cls !== 'mute';
          const past = today > 0 && d.cls !== 'mute' && d.n < today;
          return (
            <div key={d.n}
              className={`kb-day ${d.cls}${isToday ? ' today' : ''}${past ? ' past' : ''}`}
              aria-current={isToday ? 'date' : undefined}>
              {d.n}
            </div>
          );
        })}
      </div>
      <div className="kb-legend">
        <span><i style={{ background: 'var(--deadline)' }} />реєстрація</span>
        <span><i style={{ background: 'var(--primary)' }} />матчі</span>
        <span><i style={{ background: 'var(--cream)' }} />фінали</span>
      </div>
      {note && <p className="kb-today-note">{note}</p>}
    </div>
  );
}

/** Вісім слотів суперників. До жеребкування — піксельні заглушки. */
function Slots({ opponents }: { opponents: string[] }) {
  return (
    <div className="kb-slots">
      <div className="kb-lbl">ТВОЇ СУПЕРНИКИ · {opponents.length}/{SLOTS}</div>
      <div className="kb-grid">
        {Array.from({ length: SLOTS }, (_, i) => (
          opponents[i]
            ? <div key={i} className="kb-slot filled">{opponents[i]}</div>
            : <div key={i} className="kb-slot"><UnknownIcon /></div>
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
    action = <a className="kb-btn ghost" href="/yak">Як усе влаштовано →</a>;
  } else if (phase === 'league') {
    lbl = 'ЛІГА ЙДЕ'; calm = true;
    big = 'ГРАЄМО ДО 12.09';
    sub = <>Пари вже розкидані. Домовляйся про матчі й грай — час і місце обираєте самі. Список суперників надішле організатор.</>;
    action = <a className="kb-btn" href={TG}>ДЕ МОЇ ПАРИ?</a>;
  } else if (phase === 'dayx') {
    lbl = 'СЬОГОДНІ · ДЕНЬ Х'; calm = false;
    big = '13 ВЕРЕСНЯ · ДРУЇД';
    sub = <>Фінали, ФАН-частина о <em>13:00</em>, нагородження о <em>17:45</em>, афтепаті о <em>18:30</em>.</>;
    action = <a className="kb-btn ghost" href="/yak">Розклад дня →</a>;
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

      <Calendar now={new Date()} />

      <Roster meNum={p.num} />

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

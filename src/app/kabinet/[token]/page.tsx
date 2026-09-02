'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { LEVEL_LABEL, LEVEL_RATING } from '@/lib/liga';

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

/** Стабільний хеш ніка — щоб персонаж не змінювався між заходами. */
function seedOf(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const BODY: [string, string][] = [
  ['#FFC619','#C99400'], ['#F26F21','#B44A0E'], ['#7AC36A','#4E8C42'],
  ['#4FA3E3','#2C6DA3'], ['#E8765A','#B04935'], ['#B98BE0','#7E56A6'],
  ['#00CFC1','#00908A'], ['#FF2E88','#B5145C'], ['#A6E22E','#6E9C15'],
  ['#5AD1E8','#2E96AC'], ['#FF8A2A','#C25B10'], ['#D9D2C4','#9A9184'],
];
const INK = '#16110d';

/** Мʼячик-персонаж 16×16: тіло, обличчя, головний убір — усе детерміновано
    від ніка. Однаковий нік завжди дає того самого героя, файлів не потрібно. */
function avatarCells(nick: string): Record<string, string> {
  const seed = seedOf(nick);
  const pick = (shift: number, n: number) => (seed >>> shift) % n;
  const [light, dark] = BODY[pick(3, BODY.length)];
  const eyes = pick(9, 5), mouth = pick(13, 4), hat = pick(17, 5), brow = pick(21, 3);
  const put: Record<string, string> = {};
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) put[x + ',' + y] = c;
  };
  const R = 6.4, cx = 7.5, cy = 7.9;
  const inside = (x: number, y: number) => Math.hypot(x - cx, y - cy) <= R;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (inside(x, y)) {
      const d = Math.hypot(x - cx, y - cy);
      const hl = Math.hypot(x - 5.2, y - 5.4);
      set(x, y, hl < 1.5 ? '#ffffff' : (x - cx) + (y - cy) > 3.2 || d > 5.6 ? dark : light);
    } else if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) {
      set(x, y, INK);
    }
  }
  const ey = 8;
  const eye = (x: number) => {
    if (eyes === 0) { set(x, ey, INK); set(x, ey + 1, INK); }
    else if (eyes === 1) { set(x, ey, INK); set(x + 1, ey, INK); set(x, ey + 1, INK); set(x + 1, ey + 1, INK); }
    else if (eyes === 2) { set(x, ey, INK); }
    else if (eyes === 3) { set(x, ey + 1, INK); set(x + 1, ey + 1, INK); }
    else { set(x, ey, INK); set(x + 1, ey + 1, INK); }
  };
  eye(5); eye(9);
  if (brow === 1) for (const x of [5, 6, 9, 10]) set(x, ey - 2, INK);
  if (brow === 2) { set(5, ey - 2, INK); set(6, ey - 1, INK); set(10, ey - 2, INK); set(9, ey - 1, INK); }
  if (mouth === 0) { for (const x of [6, 7, 8, 9]) set(x, 11, INK); set(5, 10, INK); set(10, 10, INK); }
  else if (mouth === 1) { for (const x of [6, 7, 8, 9]) { set(x, 11, INK); set(x, 12, INK); } }
  else if (mouth === 2) { for (const x of [6, 7, 8, 9]) set(x, 11, INK); }
  else { for (const x of [6, 7, 8]) set(x, 11, INK); set(9, 10, INK); }
  if (hat === 1) for (let x = 3; x <= 12; x++) { set(x, 3, INK); set(x, 4, '#FF2E88'); }
  else if (hat === 2) {
    for (let x = 3; x <= 12; x++) set(x, 3, INK);
    for (let x = 2; x <= 13; x++) set(x, 4, INK);
    for (let x = 4; x <= 11; x++) set(x, 2, INK);
  } else if (hat === 3) { set(7, 1, INK); set(8, 1, INK); set(7, 2, '#FFC619'); set(8, 2, '#FFC619'); }
  else if (hat === 4) for (let x = 4; x <= 11; x++) set(x, 4, '#fbf1dd');
  return put;
}

function Avatar({ nick }: { nick: string }) {
  const cells = avatarCells(nick);
  const byColor: Record<string, string[]> = {};
  for (const k in cells) (byColor[cells[k]] ||= []).push(k);
  return (
    <svg className="av" viewBox="0 0 16 16" shapeRendering="crispEdges"
      role="img" aria-label={`аватар ${nick}`}>
      <rect x="0" y="0" width="16" height="16" fill="#1A1613" />
      {Object.entries(byColor).map(([color, keys]) => (
        <g key={color} fill={color}>
          {keys.map((k) => {
            const [x, y] = k.split(',');
            return <rect key={k} x={x} y={y} width="1" height="1" />;
          })}
        </g>
      ))}
    </svg>
  );
}

/** Склад турніру за макетом 2b: портретні картки 132×188 з нашими
    персонажами, під ними мінікарта всіх 32 місць. */
function Roster({ meNum }: { meNum: number }) {
  const [data, setData] = useState<{ players: { num: number; nick: string; level: number }[]; total: number; taken: number } | null>(null);
  useEffect(() => {
    fetch('/api/players', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
  }, []);
  const total = data?.total ?? 32;
  const taken = data?.taken ?? 0;
  const byNum = new Map((data?.players ?? []).map((p) => [p.num, p]));
  const left = total - taken;
  return (
    <div className="kb-roster">
      <div className="kb-rhd">
        <span className="kb-lbl">Склад турніру</span>
        <span className="kb-count">{taken}<span>/{total}</span></span>
      </div>
      <div className="kb-strip">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const p = byNum.get(n);
          const me = p && p.num === meNum;
          return (
            <div key={n} className={'kb-seat' + (me ? ' me' : p ? '' : ' free')}>
              {p ? <Avatar nick={p.nick} /> : <div className="av" />}
              <div className="nm">
                <b>{p ? p.nick : 'вільно'}</b>
                <span>{p ? (me ? 'Це ти' : LEVEL_LABEL[p.level] ?? '') : 'ще ніхто'}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="kb-mini">
        <div className="kb-minibar" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={byNum.has(i + 1) ? 'on' : ''} />
          ))}
        </div>
        <p>{left > 0
          ? `Лишилось ${left} ${left === 1 ? 'місце' : left < 5 ? 'місця' : 'місць'}.`
          : 'Усі місця зайняті.'}</p>
      </div>
    </div>
  );
}

/** Смуги фаз замість повного календаря: реєстрація · матчі · фінал,
    активна позначена рискою знизу. */
function Bands({ phase }: { phase: Phase }) {
  return (
    <div className="kb-bands">
      <div className={'kb-band reg' + (phase === 'before' ? ' now' : '')}><b>Реєстрація</b><span>1—6</span></div>
      <div className={'kb-band onl' + (phase === 'league' ? ' now' : '')}><b>Матчі</b><span>7—12</span></div>
      <div className={'kb-band fin' + (phase === 'dayx' ? ' now' : '')}><b>Фінал</b><span>13</span></div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="kb-root"><div className="kb-phone">{children}</div></div>;
}

export default function KabinetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<Player | null>(null);
  const [state, setState] = useState<'load' | 'ok' | 'missing' | 'error'>('load');
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
    <Shell><div className="kb-msg"><b>Такого запису немає</b>
      Схоже, посилання неповне або застаріле.
      <div className="kb-act" style={{ padding: '20px 0 0' }}>
        <a className="kb-btn primary" href={TG}>Написати організатору</a>
      </div></div></Shell>
  );
  if (state === 'error' || !p) return (
    <Shell><div className="kb-msg"><b>Звʼязок пропав</b>
      Не вдалося завантажити дані.
      <div className="kb-act" style={{ padding: '20px 0 0' }}>
        <button className="kb-btn" onClick={() => { setState('load'); void load(); }}>Спробувати ще раз</button>
      </div></div></Shell>
  );

  const now = new Date(tick);
  const phase = phaseNow(now);
  const left = REG_END.getTime() - now.getTime();
  const d = Math.max(0, Math.floor(left / 86400000));
  const h = Math.max(0, Math.floor(left / 3600000) % 24);
  const m = Math.max(0, Math.floor(left / 60000) % 60);
  const sec = Math.max(0, Math.floor(left / 1000) % 60);
  const name = p.nick || p.first_name || 'Гравець';
  const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
  const contact = p.telegram || (p.instagram ? '@' + p.instagram : '—');
  const open = phase === 'before';

  return (
    <Shell>
      <div className="kb-hd">
        <div className="kb-ava" aria-hidden>{initials}</div>
        <div className="kb-who">
          <b>{name}</b>
          <span>{LEVEL_LABEL[p.level] ?? '—'}{p.is_sportik ? ' · розрядник' : ''}</span>
        </div>
        <div className="kb-num">№{p.num}</div>
      </div>

      <div className="kb-now">
        <div className="kb-nowhd">
          <span className="kb-lbl">{open ? 'До кінця реєстрації' : phase === 'league' ? 'Ліга йде' : 'День Х'}</span>
          <span className={'kb-pill' + (p.paid ? '' : ' warn')}>
            <i />{p.paid ? 'Ти в списку' : 'Внесок очікується'}
          </span>
        </div>
        {open ? (
          <>
            <div className="kb-big">
              <b>{String(d).padStart(2, '0')}</b>
              <div>
                <span>{d === 1 ? 'день' : d < 5 ? 'дні' : 'днів'}</span>
                <span className="kb-hm">{String(h).padStart(2, '0')} <i>год</i> {String(m).padStart(2, '0')} <i>хв</i> <span className="kb-sec">{String(sec).padStart(2, '0')} <i>с</i></span></span>
              </div>
            </div>
            <p className="kb-sub">Закриється 6 вересня, 23:59</p>
          </>
        ) : phase === 'league' ? (
          <p className="kb-sub">Пари розкидані. Грай свої матчі до <em>12 вересня</em> — час і місце обираєте самі.</p>
        ) : phase === 'dayx' ? (
          <p className="kb-sub">Сьогодні фінали на Друїді. ФАН-частина о <em>13:00</em>, нагородження о <em>17:45</em>.</p>
        ) : (
          <p className="kb-sub">Турнір завершено. Дякуємо за гру.</p>
        )}
      </div>

      <div className="kb-hr" />
      <Roster meNum={p.num} />
      <div className="kb-hr" />

      <div className="kb-cal">
        <span className="kb-lbl">Вересень · де ми зараз</span>
        <Bands phase={phase} />
        <div className="kb-lvl">
          <div className="kb-lvlhd">
            <b>{LEVEL_LABEL[p.level] ?? '—'}</b>
            <span>рівень {p.level}/10 · ≈{LEVEL_RATING[p.level] ?? 1000}</span>
          </div>
          <div className="kb-lvlbar" role="img" aria-label={`рівень ${p.level} з 10`}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={i < p.level ? (p.level >= 8 ? 'pro' : 'on') : ''} />
            ))}
          </div>
        </div>

        <div className="kb-oppo">
          <span>Твої суперники</span>
          <b>0 / 8 <i>· жереб 6.09</i></b>
        </div>
      </div>

      <div className="kb-act">
        <a className="kb-btn" href="/yak">Як усе влаштовано →</a>
      </div>

      <div className="kb-foot">
        <div><span>Внесок</span><b>{p.pay_amount} ₴</b></div>
        <div><span>Твій контакт</span><b>{contact}</b></div>
      </div>
      <p className="kb-note">Реєстрація — до 6 вересня, 23:59. Посилання на цю сторінку — твій вхід.</p>
    </Shell>
  );
}

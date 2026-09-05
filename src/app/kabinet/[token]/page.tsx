'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { LEVEL_LABEL, LEVEL_RATING, PACKAGES } from '@/lib/liga';

type Player = {
  num: number; kind: 'player' | 'volunteer';
  first_name: string; last_name: string; nick: string | null;
  telegram: string | null; instagram?: string | null; phone?: string | null;
  level: number; is_sportik: boolean; volunteer: boolean; volunteer_roles: string[];
  pay_amount: number; paid: boolean; paid_claimed_at: string | null; created_at: string;
  pay_base?: number | null; pay_discount_pct?: number | null; pay_status?: string | null;
  payCode: string; googleLinked?: boolean;
};

/* Ключові дати турніру — єдине джерело для фази кабінету. */
const REG_END = new Date('2026-09-08T23:59:59+03:00'); // реєстрація закривається
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
      <div className={'kb-band reg' + (phase === 'before' ? ' now' : '')}><b>Реєстрація</b><span>1—8</span></div>
      <div className={'kb-band onl' + (phase === 'league' ? ' now' : '')}><b>Матчі</b><span>9—12</span></div>
      <div className={'kb-band fin' + (phase === 'dayx' ? ' now' : '')}><b>Фінал</b><span>13</span></div>
    </div>
  );
}

/* ---- піксельні знаки: та сама мова, що й аватари гравців ---------- */

function Px({ cells, color }: { cells: [number, number][]; color: string }) {
  const uniq = [...new Set(cells.map(([x, y]) => x + ',' + y))];
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" shapeRendering="crispEdges" aria-hidden>
      {uniq.map(k => {
        const [x, y] = k.split(',');
        return <rect key={k} x={x} y={y} width="1" height="1" fill={color} />;
      })}
    </svg>
  );
}

/** Галочка завтовшки два пікселі — по діагоналях, без згладжування. */
const CHECK: [number, number][] = (() => {
  const c: [number, number][] = [];
  for (let i = 0; i < 4; i++) { c.push([3 + i, 7 + i], [3 + i, 8 + i]); }
  for (let i = 0; i < 7; i++) { c.push([7 + i, 10 - i], [7 + i, 11 - i]); }
  return c;
})();

const CROSS: [number, number][] = (() => {
  const c: [number, number][] = [];
  for (let i = 0; i < 8; i++) { c.push([4 + i, 4 + i], [4 + i, 5 + i], [11 - i, 4 + i], [11 - i, 5 + i]); }
  return c;
})();

/** Пісочний годинник — для стану «платіж ще підтверджується». */
const GLASS: [number, number][] = (() => {
  const c: [number, number][] = [];
  for (let x = 3; x < 13; x++) { c.push([x, 3], [x, 12]); }
  for (let i = 0; i < 4; i++) { c.push([4 + i, 4 + i], [11 - i, 4 + i], [4 + i, 11 - i], [11 - i, 11 - i]); }
  return c;
})();

const PENCIL: [number, number][] = (() => {
  const c: [number, number][] = [];
  for (let i = 0; i < 8; i++) { c.push([4 + i, 11 - i], [5 + i, 11 - i], [4 + i, 10 - i]); }
  c.push([3, 12], [3, 11], [2, 13]);
  return c;
})();

/* ---- привітання після оплати -------------------------------------- */

type GreetKind = 'ok' | 'pending' | 'fail';

function Overlay({ label, onClose, children }:
  { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="kb-ov" role="dialog" aria-modal="true" aria-label={label}>
      <button className="kb-ovbg" onClick={onClose} aria-label="Закрити" tabIndex={-1} />
      <div className="kb-card">{children}</div>
    </div>
  );
}

function PayGreeting({ kind, p, onClose }: { kind: GreetKind; p: Player; onClose: () => void }) {
  const pack = Object.values(PACKAGES).find(x => x.price === (p.pay_base ?? 0));
  const disc = p.pay_discount_pct ? ` · знижка −${p.pay_discount_pct}%` : '';

  if (kind === 'fail') return (
    <Overlay label="Платіж не пройшов" onClose={onClose}>
      <div className="kb-stamp bad"><Px cells={CROSS} color="#E8701A" /></div>
      <span className="kb-lbl">Платіж не пройшов</span>
      <b className="kb-cardh">Гроші не списались</b>
      <p className="kb-cardp">Банк відхилив операцію — на картці нічого не змінилось.
        Спробуй ще раз або напиши організатору, розберемось.</p>
      <div className="kb-cardact">
        <a className="kb-btn primary" href={TG}>Написати організатору</a>
        <button className="kb-btn" onClick={onClose}>Закрити</button>
      </div>
    </Overlay>
  );

  if (kind === 'pending') return (
    <Overlay label="Платіж обробляється" onClose={onClose}>
      <div className="kb-stamp wait"><Px cells={GLASS} color="#F5B21B" /></div>
      <span className="kb-lbl">Платіж обробляється</span>
      <b className="kb-cardh">Майже готово</b>
      <p className="kb-cardp">Банк прийняв оплату, підтвердження ще їде.
        Онови сторінку за хвилину — статус зміниться сам.</p>
      <div className="kb-cardact">
        <button className="kb-btn primary" onClick={() => location.reload()}>Оновити</button>
        <button className="kb-btn" onClick={onClose}>Закрити</button>
      </div>
    </Overlay>
  );

  return (
    <Overlay label="Оплата пройшла" onClose={onClose}>
      <div className="kb-stamp"><Px cells={CHECK} color="#8FBE33" /></div>
      <span className="kb-lbl">Внесок отримано</span>
      <b className="kb-cardh">Ти в основі</b>
      <div className="kb-sum">
        <b>{p.pay_amount} ₴</b>
        <span>{pack ? `пакет «${pack.name}»` : 'внесок'}{disc}</span>
      </div>
      <p className="kb-cardp">Місце <em>№{p.num}</em> із 32 закріплене за тобою.
        Далі — жереб 8 вересня: суперники зʼявляться просто тут.</p>
      <div className="kb-cardact">
        <button className="kb-btn primary" onClick={onClose}>До кабінету</button>
      </div>
    </Overlay>
  );
}

/* ---- правка власних даних ----------------------------------------- */

const FIELDS_EDIT = [
  { k: 'first_name', label: 'Імʼя', ph: 'Сергій', mode: 'text' },
  { k: 'last_name', label: 'Прізвище', ph: 'Дубей', mode: 'text' },
  { k: 'nick', label: 'Нік у сітці', ph: 'SERHIO', mode: 'text' },
  { k: 'telegram', label: 'Телеграм', ph: '@nickname', mode: 'text' },
  { k: 'instagram', label: 'Інстаграм', ph: 'nickname', mode: 'text' },
  { k: 'phone', label: 'Телефон', ph: '0961234567', mode: 'tel' },
] as const;

function EditSheet({ p, token, onSaved, onClose }:
  { p: Player; token: string; onSaved: (x: Player) => void; onClose: () => void }) {
  const [v, setV] = useState<Record<string, string>>({
    first_name: p.first_name ?? '', last_name: p.last_name ?? '', nick: p.nick ?? '',
    telegram: p.telegram ?? '', instagram: p.instagram ?? '', phone: p.phone ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/ya/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const j = await r.json();
      if (!r.ok) { setErr({ field: j.field, message: j.message ?? 'Не вдалося зберегти.' }); return; }
      onSaved(j.player); onClose();
    } catch { setErr({ message: 'Звʼязок пропав. Спробуй ще раз.' }); }
    finally { setBusy(false); }
  }

  return (
    <Overlay label="Виправити свої дані" onClose={onClose}>
      <span className="kb-lbl">Твої дані</span>
      <b className="kb-cardh">Виправити</b>
      <p className="kb-cardp">Змінюй скільки треба — рівень, номер у списку й оплата лишаються як є.</p>
      <div className="kb-form">
        {FIELDS_EDIT.map(f => (
          <label key={f.k} className={'kb-fld' + (err?.field === f.k ? ' bad' : '')}>
            <span>{f.label}</span>
            <input
              type={f.mode} inputMode={f.mode === 'tel' ? 'tel' : undefined}
              value={v[f.k]} placeholder={f.ph} autoComplete="off"
              onChange={e => setV({ ...v, [f.k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      {err && <p className="kb-err">{err.message}</p>}
      <div className="kb-cardact">
        <button className="kb-btn primary" onClick={save} disabled={busy}>
          {busy ? 'Зберігаю…' : 'Зберегти'}
        </button>
        <button className="kb-btn" onClick={onClose} disabled={busy}>Скасувати</button>
      </div>
    </Overlay>
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
  const [greet, setGreet] = useState<'ok' | 'fail' | null>(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ?pay проставляє /api/pay/return; прибираємо його з адреси,
  // щоб оновлення сторінки не показувало привітання вдруге
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('pay');
    if (q !== 'ok' && q !== 'fail') return;
    setGreet(q);
    const u = new URL(window.location.href);
    u.searchParams.delete('pay');
    window.history.replaceState(null, '', u.pathname + u.search + u.hash);
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
        <button className="kb-edit" onClick={() => setEdit(true)}
          aria-label="Виправити свої дані" title="Виправити свої дані">
          <i><Px cells={PENCIL} color="#F5B21B" /></i>
          <span>Правка</span>
        </button>
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
            <p className="kb-sub">Закриється 8 вересня, 23:59</p>
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
          <b>0 / 8 <i>· жереб 8.09</i></b>
        </div>
      </div>

      <div className="kb-act">
        <a className="kb-btn" href="/yak">Як усе влаштовано →</a>
      </div>

      <div className="kb-foot">
        <div><span>{p.paid ? 'Оплачено' : 'До оплати'}</span>
          <b>{p.pay_amount} ₴{p.pay_discount_pct ? ` −${p.pay_discount_pct}%` : ''}</b></div>
        <div><span>Твій контакт</span><b>{contact}</b></div>
      </div>
      <p className="kb-note">Реєстрація — до 8 вересня, 23:59. Посилання на цю сторінку — твій вхід.</p>

      {greet && (
        <PayGreeting
          kind={greet === 'fail' ? 'fail' : p.paid ? 'ok' : 'pending'}
          p={p} onClose={() => setGreet(null)}
        />
      )}
      {edit && (
        <EditSheet p={p} token={token} onClose={() => setEdit(false)}
          onSaved={x => setP(x)} />
      )}
    </Shell>
  );
}

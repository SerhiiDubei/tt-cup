'use client';

import { useEffect, useState } from 'react';
import { LEVEL_LABEL } from '@/lib/liga';

type Row = {
  id: string; num: number; kind: 'player' | 'volunteer';
  first_name: string; last_name: string; nick: string | null; telegram: string;
  level: number; volunteer: boolean; pay_amount: number; paid: boolean;
  paid_claimed_at: string | null; payCode: string;
  pay_status: string | null; pay_order_ref: string | null;
  withdrawn_at: string | null; // не null = знявся з турніру
};

/**
 * Адмінка оплат ліги: список реєстрацій + чек «оплачено» після звірки виписки банки.
 * Той самий ADMIN_CODE, що й у старій адмінці кубка; код тримаємо в sessionStorage.
 */
export default function LigaAdminPage() {
  const [code, setCode] = useState('');
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('dbc_admin') || '';
    if (saved) { setCode(saved); login(saved); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call(body: Record<string, unknown>) {
    const r = await fetch('/api/liga-admin', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  async function login(c: string) {
    setErr(''); setBusy(true);
    try {
      const { players } = await call({ code: c, op: 'list' });
      setRows(players); setAuthed(true);
      sessionStorage.setItem('dbc_admin', c);
    } catch (e) {
      setErr((e as Error).message === 'unauthorized' ? 'Невірний код' : 'Помилка: ' + (e as Error).message);
    } finally { setBusy(false); }
  }

  async function setPaid(row: Row, paid: boolean) {
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, paid } : r))); // оптимістично
    try { await call({ code, op: 'set_paid', id: row.id, paid }); }
    catch { setRows((p) => p.map((r) => (r.id === row.id ? { ...r, paid: !paid } : r))); }
  }

  async function setWithdrawn(row: Row, withdrawn: boolean) {
    const who = row.nick || `${row.first_name} ${row.last_name}`;
    if (withdrawn && !confirm(`Зняти ${who} (${row.payCode}) з турніру? Він зникне зі складу на сайті. Гроші це не повертає — REFUND робиться у WayForPay окремо.`)) return;
    const prev = row.withdrawn_at;
    const next = withdrawn ? new Date().toISOString() : null;
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, withdrawn_at: next } : r))); // оптимістично
    try { await call({ code, op: withdrawn ? 'withdraw' : 'restore', id: row.id }); }
    catch (e) {
      setRows((p) => p.map((r) => (r.id === row.id ? { ...r, withdrawn_at: prev } : r)));
      alert('Не вийшло: ' + (e as Error).message); // напр. 409 — міграцію ще не вставлено
    }
  }

  const players = rows.filter((r) => r.kind !== 'volunteer');
  const vols = rows.filter((r) => r.kind === 'volunteer');
  // Хто знявся — не рахується ні як гравець, ні як гроші: внесок повернуто або повертається.
  const active = players.filter((r) => !r.withdrawn_at);
  const withdrawnCount = players.length - active.length;
  const paidCount = active.filter((r) => r.paid).length;
  const claimedCount = active.filter((r) => !r.paid && r.paid_claimed_at).length;
  const total = active.reduce((s, r) => s + (r.paid ? r.pay_amount : 0), 0);

  return (
    <main className="jn-root"><div className="jn-wrap" style={{ maxWidth: 640 }}>
      <span className="jn-brand">DRUID BATTLE CUP · оплати</span>

      {!authed ? (
        <>
          <h1 className="jn-h1">Код орга</h1>
          <input className="jn-input" type="password" placeholder="код" value={code}
            onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login(code)} />
          <button className="jn-btn" disabled={busy || !code} onClick={() => login(code)}>
            {busy ? '…' : 'Увійти'}
          </button>
          {err && <p className="jn-err">{err}</p>}
        </>
      ) : (
        <>
          <h1 className="jn-h1">Реєстрації</h1>
          <div className="jn-chips" style={{ marginBottom: 14 }}>
            <span className="jn-chip">Гравців: {active.length}</span>
            <span className="jn-chip lime">Оплачено: {paidCount}</span>
            <span className="jn-chip yellow">Кажуть що оплатили: {claimedCount}</span>
            <span className="jn-chip cyan">Зібрано: {total} грн</span>
            <span className="jn-chip">Волонтерів: {vols.length} 🙌</span>
            {withdrawnCount > 0 && <span className="jn-chip">Знялись: {withdrawnCount} ⛔</span>}
          </div>
          <div className="jn-card">
            {rows.length === 0 && <p className="jn-hint" style={{ margin: 0 }}>Поки нікого — чекаємо перших.</p>}
            {rows.map((r) => (
              <div className="jn-row" key={r.id} style={r.withdrawn_at ? { opacity: 0.55 } : undefined}>
                <div className="who">
                  <b>
                    {r.kind === 'volunteer'
                      ? `🙌 ${r.first_name} ${r.last_name}`
                      : <>{r.payCode} · {r.nick} {r.withdrawn_at ? '⛔ знявся ' : ''}{r.paid_claimed_at && !r.paid ? '🟡' : ''}{r.volunteer ? ' 🙌' : ''}</>}
                  </b>
                  <span>
                    {r.kind === 'volunteer'
                      ? `${r.telegram} · волонтер · без оплати`
                      : `${r.first_name} ${r.last_name} · ${r.telegram} · ${LEVEL_LABEL[r.level] ?? r.level} · ${r.pay_amount} грн`
                        + (r.pay_status === 'refunded' ? ' · ↩ повернуто' : '')}
                  </span>
                </div>
                {r.kind !== 'volunteer' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className={'jn-paybtn' + (r.paid ? ' on' : '')} onClick={() => setPaid(r, !r.paid)}>
                      {r.paid ? '✅ Оплачено' : 'Позначити оплату'}
                    </button>
                    <button className="jn-paybtn" onClick={() => setWithdrawn(r, !r.withdrawn_at)}>
                      {r.withdrawn_at ? '↺ Повернути у склад' : '⛔ Зняти'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="jn-btn ghost" onClick={() => login(code)}>↻ Оновити</button>
        </>
      )}
    </div></main>
  );
}

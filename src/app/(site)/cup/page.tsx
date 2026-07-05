'use client';
import { useEffect, useRef, useState } from 'react';
import type { CupState, CupPlayer, CupMatch } from '@/lib/cup/types';
import { loadCup, saveCup, clearCup } from '@/lib/cup/storage';
import { createBracket, reportResult, resetResult } from '@/lib/cup/doubleElim';
import { makePlayer, randomPlayers, shuffle } from '@/lib/cup/players';
import { SUPERPOWER_LABEL } from '@/lib/avatar';
import CupHero from '@/components/cup/CupHero';
import CupBracket from '@/components/cup/CupBracket';

function emptyCup(): CupState {
  return {
    id: 'cup', name: 'КУБОК', createdAt: 0, phase: 'setup',
    players: [], matches: [], championId: null, runnerUpId: null,
  };
}

export default function CupPage() {
  const [state, setState] = useState<CupState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [picking, setPicking] = useState<string | null>(null);
  const uid = useRef(1);

  useEffect(() => {
    const s = loadCup() ?? emptyCup();
    setState(s);
    // keep uid ahead of any restored ids
    s.players.forEach((p) => {
      const n = parseInt(p.id.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n >= uid.current) uid.current = n + 1;
    });
    setMounted(true);
  }, []);

  function commit(next: CupState) { saveCup(next); setState(next); }
  const newId = () => `pl${uid.current++}`;

  function addOne(raw: string) {
    if (!state) return;
    const nm = raw.trim();
    if (!nm) return;
    const p = makePlayer(nm, Math.random, newId());
    commit({ ...state, players: [...state.players, p] });
    setName('');
  }
  function addRandom(n: number) {
    if (!state) return;
    const fresh = randomPlayers(n, Math.random).map((p) => ({ ...p, id: newId() }));
    commit({ ...state, players: [...state.players, ...fresh] });
  }
  function removePlayer(id: string) {
    if (!state) return;
    commit({ ...state, players: state.players.filter((p) => p.id !== id) });
  }
  function start() {
    if (!state || state.players.length < 2) return;
    const seeded = shuffle(state.players, Math.random);
    commit(createBracket(seeded, Date.now(), state.name || 'КУБОК'));
  }
  function restart() {
    if (!confirm('Почати заново? Поточний турнір зникне.')) return;
    clearCup();
    const e = emptyCup();
    uid.current = 1;
    setState(e);
  }
  function submitScore(matchId: string, sa: number, sb: number) {
    if (!state || sa === sb) return;
    try {
      const m = state.matches.find((x) => x.id === matchId);
      let next = state;
      if (m && m.status === 'reported') next = resetResult(state, matchId);
      next = reportResult(next, matchId, sa, sb);
      commit(next);
      setPicking(null);
    } catch (e) {
      alert('Не вдалось зберегти рахунок: ' + (e as Error).message);
    }
  }

  if (!mounted || !state) {
    return <main><section><div className="wrap"><p style={{ padding: '40px 0' }}>Завантаження…</p></div></section></main>;
  }

  const pmap: Record<string, CupPlayer> = Object.fromEntries(state.players.map((p) => [p.id, p]));
  const champ = state.championId ? pmap[state.championId] : null;
  const runner = state.runnerUpId ? pmap[state.runnerUpId] : null;
  // a "real" match is any genuine contest — excludes auto-resolved byes and void slots
  const isReal = (m: CupMatch) => !(m.status === 'reported' && (m.winner === null || !m.a || !m.b));
  const total = state.matches.filter(isReal).length;
  const played = state.matches.filter((m) => isReal(m) && m.status === 'reported').length;
  const pickMatch = picking ? state.matches.find((m) => m.id === picking) ?? null : null;

  return (
    <main>
      <CupStyles />
      <section>
        <div className="wrap">
          <span className="eyebrow reveal in">кубок · окремий інструмент</span>

          {/* ===== SETUP ===== */}
          {state.phase === 'setup' && (
            <>
              <h2 className="title reveal in">Проведи свій <span className="swirl">КУБОК</span></h2>
              <p className="lead reveal in">Додай гравців, перемішай — і грай на виліт у форматі <b>double elimination</b>: програв → у нижню лігу, програв ще раз → виліт.</p>

              <div className="card reveal in" style={{ marginTop: 24, maxWidth: 720 }}>
                <label className="cup-lbl">Назва турніру</label>
                <input className="input" value={state.name} maxLength={28} onChange={(e) => commit({ ...state, name: e.target.value })} placeholder="КУБОК" />

                <label className="cup-lbl" style={{ marginTop: 18 }}>Додати гравця</label>
                <div className="cup-addrow">
                  <input className="input" value={name} maxLength={24} placeholder="Імʼя гравця"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addOne(name); }} />
                  <button className="btn cyan" onClick={() => addOne(name)}>+ Додати</button>
                </div>
                <div className="cup-randrow">
                  <button className="btn ghost" onClick={() => addRandom(4)}>+4 рандомні</button>
                  <button className="btn ghost" onClick={() => addRandom(8)}>+8 рандомних</button>
                  <button className="btn ghost" onClick={() => addRandom(16)}>+16 рандомних</button>
                </div>
              </div>

              <div className="cup-players reveal in">
                {state.players.map((p) => (
                  <div className="cup-ptile" key={p.id}>
                    <button className="cup-rm" onClick={() => removePlayer(p.id)} aria-label="Прибрати">×</button>
                    <CupHero player={p} size={92} />
                    <div className="cup-pname">{p.name}</div>
                    <div className="cup-ppow chip">{SUPERPOWER_LABEL[p.style] ?? p.style}</div>
                  </div>
                ))}
                {state.players.length === 0 && <p className="cup-empty">Поки нікого — додай гравців ↑</p>}
              </div>

              <div className="cup-startbar">
                <span className="chip live">{state.players.length} гравців</span>
                <button className="btn pink" disabled={state.players.length < 2} onClick={start}>
                  🔀 Перемішати та створити сітку
                </button>
              </div>
            </>
          )}

          {/* ===== RUNNING ===== */}
          {state.phase === 'running' && (
            <>
              <h2 className="title reveal in" style={{ marginBottom: 6 }}>{state.name}</h2>
              <div className="cup-toolbar reveal in">
                <span className="chip live">Зіграно {played} / {total}</span>
                <span className="cup-hint">Тапни матч → внеси рахунок</span>
                <button className="btn ghost" onClick={restart}>↺ Почати заново</button>
              </div>
              <CupBracket matches={state.matches} players={pmap} onPick={setPicking} />
            </>
          )}

          {/* ===== DONE ===== */}
          {state.phase === 'done' && champ && (
            <>
              <h2 className="title reveal in">{state.name} — <span className="swirl">фінал</span></h2>
              <div className="cup-champ reveal in">
                <div className="cup-champ-art bounce"><CupHero player={champ} size={200} /></div>
                <div className="cup-champ-badge">ЧЕМПІОН 🏆</div>
                <div className="cup-champ-name">{champ.name}</div>
                {runner && <div className="cup-runner">🥈 {runner.name}</div>}
                <button className="btn pink" style={{ marginTop: 18 }} onClick={restart}>＋ Новий турнір</button>
              </div>
              <CupBracket matches={state.matches} players={pmap} onPick={setPicking} />
            </>
          )}
        </div>
      </section>

      {pickMatch && pickMatch.a && pickMatch.b && (
        <ScoreModal
          a={pmap[pickMatch.a]} b={pmap[pickMatch.b]}
          initA={pickMatch.scoreA} initB={pickMatch.scoreB}
          reported={pickMatch.status === 'reported'}
          onClose={() => setPicking(null)}
          onSave={(sa, sb) => submitScore(pickMatch.id, sa, sb)}
        />
      )}
    </main>
  );
}

function ScoreModal({
  a, b, initA, initB, reported, onClose, onSave,
}: {
  a: CupPlayer; b: CupPlayer; initA: number; initB: number; reported: boolean;
  onClose: () => void; onSave: (sa: number, sb: number) => void;
}) {
  const [sa, setSa] = useState(reported ? initA : 0);
  const [sb, setSb] = useState(reported ? initB : 0);
  const clamp = (n: number) => Math.max(0, Math.min(30, n)); // до 11 і вище (овертайм/«більше»)
  const tie = sa === sb;

  const Stepper = ({ who, val, set, p }: { who: string; val: number; set: (n: number) => void; p: CupPlayer }) => (
    <div className={'cup-step' + (!tie && ((who === 'a' && sa > sb) || (who === 'b' && sb > sa)) ? ' lead' : '')}>
      <CupHero player={p} size={72} showPower={false} />
      <div className="cup-step-name">{p.name}</div>
      <div className="cup-step-ctrl">
        <button className="cup-stbtn" onClick={() => set(clamp(val - 1))}>−</button>
        <span className="cup-stval">{val}</span>
        <button className="cup-stbtn" onClick={() => set(clamp(val + 1))}>＋</button>
      </div>
    </div>
  );

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal cup-scoremodal" onClick={(e) => e.stopPropagation()}>
        <h3 className="cup-modal-title">Рахунок матчу</h3>
        <div className="cup-steps">
          <Stepper who="a" val={sa} set={setSa} p={a} />
          <span className="cup-vs">:</span>
          <Stepper who="b" val={sb} set={setSb} p={b} />
        </div>
        {tie && <p className="cup-tie">Нічиїх не буває — постав різний рахунок</p>}
        {reported && <p className="cup-warn">Зміна результату скине наступні матчі цих гравців.</p>}
        <div className="cup-modal-btns">
          <button className="btn ghost" onClick={onClose}>Скасувати</button>
          <button className="btn pink" disabled={tie} onClick={() => onSave(sa, sb)}>Зберегти</button>
        </div>
      </div>
    </div>
  );
}

function CupStyles() {
  return (
    <style>{`
      .cup-lbl{display:block;font-weight:800;font-size:13px;margin-bottom:7px;color:var(--ink-soft)}
      .cup-addrow{display:flex;gap:10px;flex-wrap:wrap}
      .cup-addrow .input{flex:1;min-width:180px}
      .cup-randrow{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
      .cup-players{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:14px;margin:26px 0}
      .cup-ptile{position:relative;background:var(--paper);border:3px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:12px 8px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;transition:transform .15s var(--ease)}
      .cup-ptile:hover{transform:translateY(-3px) rotate(-1deg)}
      .cup-pname{font-weight:800;font-size:13px;text-align:center;line-height:1.1}
      .cup-ppow{font-size:11px;padding:2px 8px}
      .cup-rm{position:absolute;top:-9px;right:-9px;width:26px;height:26px;border:3px solid var(--line);border-radius:50%;background:var(--coral);color:#fff;font-weight:900;cursor:pointer;line-height:1;z-index:2}
      .cup-rm:hover{transform:scale(1.12)}
      .cup-empty{grid-column:1/-1;color:var(--ink-soft);padding:20px 0}
      .cup-startbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:8px}
      .cup-toolbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:10px 0 22px}
      .cup-hint{color:var(--ink-soft);font-size:13px}

      .cup-bracket{display:flex;flex-direction:column;gap:30px}
      .cup-section{}
      .cup-secttitle{font-family:var(--font-display);font-weight:800;font-size:clamp(18px,3vw,26px);margin:0 0 12px}
      .cup-cols{display:flex;gap:18px;overflow-x:auto;padding-bottom:10px;align-items:flex-start}
      .cup-col{display:flex;flex-direction:column;gap:10px;min-width:212px}
      .cup-colhead{font-weight:800;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-soft);background:var(--bg);border:2px dashed var(--line);border-radius:10px;padding:4px 10px;text-align:center}
      .cup-colbody{display:flex;flex-direction:column;gap:14px;justify-content:space-around;flex:1}

      .cup-match{position:relative;width:100%;text-align:left;background:var(--paper);border:3px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:8px 8px 8px;display:flex;flex-direction:column;gap:6px;cursor:pointer;font-family:var(--font-body);transition:transform .12s var(--ease)}
      .cup-match.live{cursor:pointer}
      .cup-match.live:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 var(--ink)}
      .cup-match:disabled{cursor:default;opacity:.78}
      .cup-mlabel{position:absolute;top:-11px;left:10px;background:var(--yellow);border:2px solid var(--line);border-radius:20px;font-size:9px;font-weight:800;padding:1px 7px;text-transform:uppercase}
      .cup-row{display:flex;align-items:center;gap:8px;padding:3px 4px;border-radius:9px}
      .cup-row.w{background:var(--lime)}
      .cup-tbd{width:34px;height:34px;border:3px dashed var(--line);border-radius:8px;opacity:.5;flex:0 0 auto}
      .cup-name{flex:1;font-weight:700;font-size:13px;line-height:1.05;display:flex;flex-direction:column}
      .cup-name.out{opacity:.55;text-decoration:line-through}
      .cup-outtag{font-size:9px;font-weight:800;color:var(--coral);text-decoration:none;letter-spacing:.03em}
      .cup-score{font-family:var(--font-display);font-weight:900;font-size:18px;min-width:20px;text-align:center}
      .cup-gf .cup-match{border-width:4px;background:linear-gradient(180deg,#fff,#FFF6DA)}

      .cup-champ{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;margin:26px 0 36px}
      .cup-champ-art{filter:drop-shadow(8px 8px 0 var(--ink))}
      .cup-champ-badge{font-family:var(--font-display);font-weight:900;font-size:clamp(22px,5vw,40px);background:var(--yellow);border:3px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:6px 18px;transform:rotate(-2deg)}
      .cup-champ-name{font-family:var(--font-display);font-weight:800;font-size:clamp(20px,4vw,32px)}
      .cup-runner{font-weight:700;color:var(--ink-soft)}

      .cup-scoremodal{text-align:center}
      .cup-modal-title{font-family:var(--font-display);font-weight:800;font-size:20px;margin:0 0 14px}
      .cup-steps{display:flex;align-items:center;justify-content:center;gap:14px}
      .cup-step{display:flex;flex-direction:column;align-items:center;gap:6px;border:3px solid transparent;border-radius:14px;padding:8px;transition:.15s}
      .cup-step.lead{border-color:var(--lime);background:#F4FFDD}
      .cup-step-name{font-weight:800;font-size:13px;max-width:110px;line-height:1.1}
      .cup-step-ctrl{display:flex;align-items:center;gap:8px;margin-top:2px}
      .cup-stbtn{width:34px;height:34px;border:3px solid var(--line);border-radius:10px;background:var(--paper);font-weight:900;font-size:18px;cursor:pointer;line-height:1}
      .cup-stbtn:hover{background:var(--yellow)}
      .cup-stval{font-family:var(--font-display);font-weight:900;font-size:26px;min-width:28px}
      .cup-vs{font-family:var(--font-display);font-weight:900;font-size:26px}
      .cup-tie{color:var(--coral);font-weight:700;font-size:13px;margin:12px 0 0}
      .cup-warn{color:var(--ink-soft);font-size:12px;margin:10px 0 0}
      .cup-modal-btns{display:flex;gap:10px;justify-content:center;margin-top:16px}

      @media(max-width:560px){
        .cup-col{min-width:184px}
        .cup-players{grid-template-columns:repeat(auto-fill,minmax(108px,1fr))}
      }
    `}</style>
  );
}

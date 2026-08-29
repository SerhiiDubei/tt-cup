'use client';

import { useEffect, useRef, useState } from 'react';
import './onb.css';

/**
 * ТЕСТ-СТЕНД ОНБОРДИНГУ (/onb) — три варіанти Q&A як RPG-діалог:
 *  A · один співрозмовник (класичний діалог)
 *  B · три персонажі-«експерти» (модуль = персонаж + свій фон)
 *  C · чат у месенджері (quick replies)
 * Фони — стилізовані з реальних денних фото Друїда (public/onb/bg).
 * Персонажі поки БЕЗ спрайтів — лише бейдж-ініціал (спрайтшити далі).
 */

type QA = { q: string; a: string };
type Mod = { id: string; who: string; face: string; faceCls?: string; bg: string; statement: string; qs: QA[] };

const BG = {
  front: '/onb/bg/bg-court-front.jpg',
  close: '/onb/bg/bg-table-close.jpg',
  terrace: '/onb/bg/bg-terrace.jpg',
};

/* Матриця Q&A — спільна для всіх трьох варіантів. */
const MODS: Mod[] = [
  {
    id: 'm1', who: 'Пані Фрося', face: 'Ф', faceCls: 'yellow', bg: BG.terrace,
    statement: 'На Друїді стартує Druid Battle Cup — турнір з настільного тенісу. Питай, що цікавить.',
    qs: [
      { q: 'Що за турнір?', a: 'Дві фази: зараз — онлайн, граєш матчі у зручний час. А 12 вересня — фінал наживо, тут, у дворі.' },
      { q: 'Хто може грати?', a: 'Будь-хто. Сітка розведе по силі — грати буде цікаво і новачку, і спортику.' },
      { q: 'Скільки коштує?', a: 'Реєстрація безкоштовна. Всі деталі участі — ближче до фіналу.' },
    ],
  },
  {
    id: 'm2', who: 'Ярема', face: 'Я', bg: BG.close,
    statement: 'Механіка — це до мене. Питай, поки я тут.',
    qs: [
      { q: 'З ким я граю?', a: 'Система сама збере сітку й дасть тобі 8 суперників. Список побачиш у кабінеті.' },
      { q: 'Коли і де грати?', a: 'Списуєшся з суперником у телеграмі — і граєте, коли зручно обом. Хоч зранку, хоч опівночі.' },
      { q: 'А якщо суперник зник?', a: 'Матч не зараховується. Пишеш у саппорт — розрулимо, ти нічого не втрачаєш.' },
      { q: 'Що за очки й сітки?', a: 'За перемоги — очки. Вони ведуть у верхню чи нижню сітку. Не вилітає ніхто — грають усі до фіналу.' },
    ],
  },
  {
    id: 'm3', who: 'BAT RIDER', face: 'B', faceCls: 'cyan', bg: BG.front,
    statement: 'А тепер головне. 12 вересня. Друїд. Наживо.',
    qs: [
      { q: 'Що буде на фіналі?', a: 'Столи в ряд, повний двір людей. Приходиш зі своєю позицією з онлайн-фази — і граєш.' },
      { q: 'Що за міні-ігри?', a: 'Стаканчики, відро і ще купа приколів. Легенди складають не тільки про чемпіонів.' },
    ],
  },
];

function Bg({ src, blur }: { src: string; blur?: boolean }) {
  return (
    <div className={'ob-bg' + (blur ? ' blur' : '')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}

/* ---------- Заглушка кабінету після «реєстрації» ---------- */
function Stub({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Bg src={BG.front} blur />
      <div className="ob-stub">
        <div className="ball" />
        <h2>Ти в грі!</h2>
        <p>Google-акаунт підтягнуто. Сітка збирається — ми напишемо, щойно буде твій перший суперник.</p>
        <span className="tag">ОЧІКУЙ ДАЛІ · тут буде анімашка</span>
        <button className="ob-back" onClick={onBack} style={{ marginTop: 18 }}>← у тест-хаб</button>
      </div>
    </>
  );
}

/* ---------- Варіанти A і B: діалог зі стейтментом і питаннями ----------
   A = один персонаж на всі модулі (фон один), B = свій персонаж і фон на модуль. */
function Dialog({ single, onBack, onDone }: { single: boolean; onBack: () => void; onDone: () => void }) {
  const [mi, setMi] = useState(0);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [answer, setAnswer] = useState<string | null>(null);
  const mod = MODS[mi];
  const who = single ? { who: 'Ярема', face: 'Я', faceCls: undefined } : mod;
  const bg = single ? BG.front : mod.bg;
  const left = mod.qs.filter((x) => !opened[mod.id + x.q]);
  const openQ = (x: QA) => { setOpened((o) => ({ ...o, [mod.id + x.q]: true })); setAnswer(x.a); };
  const next = () => { setAnswer(null); mi < MODS.length - 1 ? setMi(mi + 1) : onDone(); };

  return (
    <>
      <Bg src={bg} />
      <div className="ob-top">
        <button className="ob-back" onClick={onBack}>← вихід</button>
        <div className="ob-dots">
          {MODS.map((m, i) => <span key={m.id} className={'ob-dot' + (i === mi ? ' on' : i < mi ? ' done' : '')} />)}
        </div>
      </div>
      <div className="ob-body">
        <div className="ob-who">
          <span className={'ob-face ' + (who.faceCls ?? '')}>{who.face}</span>
          <b>{who.who}</b>
        </div>
        <div className="ob-say" key={mod.id + (answer ?? 'st')}>{answer ?? mod.statement}</div>
        <div className="ob-qs">
          {left.map((x) => (
            <button className="ob-q" key={x.q} onClick={() => openQ(x)}>
              <span className="qm">?</span>{x.q}
            </button>
          ))}
        </div>
        <button className={'ob-next' + (mi === MODS.length - 1 ? '' : left.length === 0 ? ' lime' : '')} onClick={next}>
          {mi === MODS.length - 1 ? 'Зареєструватися →' : left.length === 0 ? 'Далі →' : 'Все ясно, далі →'}
        </button>
        {left.length > 0 && <span className="ob-count">питань лишилось: {left.length}</span>}
      </div>
    </>
  );
}

/* ---------- Варіант C: чат ---------- */
type ChatMsg = { me?: boolean; text: string };
function Chat({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [feed, setFeed] = useState<ChatMsg[]>([{ text: 'Йоу! Ти по турніру? Питай — відповім як людині. Або одразу тисни реєстрацію.' }]);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const all = MODS.flatMap((m) => m.qs);
  const left = all.filter((x) => !asked[x.q]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [feed, typing]);

  const ask = (x: QA) => {
    setAsked((o) => ({ ...o, [x.q]: true }));
    setFeed((f) => [...f, { me: true, text: x.q }]);
    setTyping(true);
    setTimeout(() => { setTyping(false); setFeed((f) => [...f, { text: x.a }]); }, 650);
  };

  return (
    <>
      <Bg src={BG.front} blur />
      <div className="ob-chat">
        <div className="ob-chat-head">
          <button className="ob-back" onClick={onBack}>←</button>
          <span className="ob-face">Д</span>
          <div className="t"><b>Druid Battle Cup</b><span>онлайн</span></div>
        </div>
        <div className="ob-feed">
          {feed.map((m, i) => <div key={i} className={'ob-msg ' + (m.me ? 'me' : 'them')}>{m.text}</div>)}
          {typing && <div className="ob-typing"><i /><i /><i /></div>}
          <div ref={endRef} />
        </div>
        <div className="ob-replies">
          {left.slice(0, 3).map((x) => <button key={x.q} className="ob-reply" onClick={() => ask(x)}>{x.q}</button>)}
          <button className="ob-reply cta" onClick={onDone}>Все ясно — реєструй ⚡</button>
        </div>
      </div>
    </>
  );
}

/* ---------- Хаб ---------- */
export default function OnbLab() {
  const [v, setV] = useState<'hub' | 'a' | 'b' | 'c' | 'stub'>('hub');
  const back = () => setV('hub');
  const done = () => setV('stub');

  return (
    <main className="ob-root"><div className="ob-stage">
      {v === 'hub' && (
        <>
          <Bg src={BG.front} />
          <div className="ob-hub">
            <h1>Онбординг · тест</h1>
            <p className="sub">Q&A як RPG-діалог. Три механіки — обери й проклацай до кінця.</p>
            <button className="ob-hub-btn" onClick={() => setV('a')}>
              <span className="n">A</span>
              <span><b>Один співрозмовник</b><span>класичний діалог: стейтмент → питання зникають</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('b')}>
              <span className="n">B</span>
              <span><b>Три персонажі</b><span>модуль = свій «експерт» і своя локація</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('c')}>
              <span className="n">C</span>
              <span><b>Чат</b><span>месенджер: quick replies + «набирає…»</span></span>
            </button>
          </div>
        </>
      )}
      {v === 'a' && <Dialog key="a" single onBack={back} onDone={done} />}
      {v === 'b' && <Dialog key="b" single={false} onBack={back} onDone={done} />}
      {v === 'c' && <Chat key="c" onBack={back} onDone={done} />}
      {v === 'stub' && <Stub onBack={back} />}
    </div></main>
  );
}

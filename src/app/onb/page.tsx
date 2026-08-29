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

/* ---------- Дані для D/E/F: тема → СЕРІЯ реплік (як в RPG) ----------
   voice = «внутрішній голос» неживої речі двору (референс Disco Elysium). */
type Line = { who: string; text: string; mood?: string; voice?: boolean };
type Topic = { q: string; lines: Line[] };

const TOPICS: Topic[] = [
  {
    q: 'Що за турнір?',
    lines: [
      { who: 'ЯРЕМА', mood: 'інтрига', text: 'О, правильне питання. Druid Battle Cup. Дві фази.' },
      { who: 'ЯРЕМА', mood: 'пояснює', text: 'Перша — онлайн. Граєш матчі, коли зручно тобі. Без суддів і секундоміра.' },
      { who: 'СТІЛ', voice: true, text: 'Всі вони грають на мені. Вдень, ввечері. Я все памʼятаю.' },
      { who: 'ЯРЕМА', mood: 'гордість', text: 'Друга фаза — 12 вересня. Фінал наживо. Тут, у цьому дворі.' },
    ],
  },
  {
    q: 'Як це працює?',
    lines: [
      { who: 'ЯРЕМА', mood: 'пояснює', text: 'Система сама збирає сітку й видає тобі вісім суперників.' },
      { who: 'ЯРЕМА', mood: 'спокій', text: 'Бачиш нік суперника в телеграмі — списуєшся, і граєте, коли зручно обом.' },
      { who: 'ГІРЛЯНДА', voice: true, text: 'Минулого разу двоє грали о пів на першу ночі. Я світила. Було красиво.' },
      { who: 'ЯРЕМА', mood: 'підбадьорює', text: 'За перемоги — очки. Вони ведуть у верхню чи нижню сітку. Але грають усі — до фіналу.' },
    ],
  },
  {
    q: 'Скільки коштує?',
    lines: [
      { who: 'ЯРЕМА', mood: 'чесно', text: 'Реєстрація безкоштовна. Взагалі.' },
      { who: 'ЯРЕМА', mood: 'підморгує', text: 'Всі деталі участі — ближче до фіналу. Зараз головне застовпити місце в сітці.' },
    ],
  },
  {
    q: 'А якщо суперник зник?',
    lines: [
      { who: 'ЯРЕМА', mood: 'знизує плечима', text: 'Буває. Людина злилась, не відповідає — матч просто не зараховується.' },
      { who: 'ЯРЕМА', mood: 'спокій', text: 'Пишеш у саппорт — розрулимо. Ти нічого не втрачаєш.' },
      { who: 'ДВІР', voice: true, text: 'Я бачив багатьох, хто зникав. Вони завжди повертаються. За лимонадом.' },
    ],
  },
  {
    q: 'Що буде на фіналі?',
    lines: [
      { who: 'ЯРЕМА', mood: 'хайп', text: '12 вересня. Столи в ряд, повний двір людей.' },
      { who: 'ЯРЕМА', mood: 'пояснює', text: 'Приходиш зі своєю позицією з онлайн-фази — і граєш наживо.' },
      { who: 'ЯРЕМА', mood: 'хайп', text: 'І не тільки теніс: стаканчики, відро, ще купа приколів.' },
      { who: 'СТІЛ', voice: true, text: 'У день фіналу я не сам. Привозять родичів. Ми стоїмо в ряд, як на параді.' },
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

/* ---------- D · Disco Elysium: накопичувальна стрічка-скрипт ----------
   Все лишається в історії; відповідь = серія реплік з паузами; «голоси»
   речей двору вриваються курсивом; пройдені теми тьмяніють, але клікабельні. */
function Disco({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [feed, setFeed] = useState<Line[]>([
    { who: 'ЯРЕМА', text: 'На Друїді стартує турнір. Питай — я нікуди не поспішаю.' },
    { who: 'ДВІР', voice: true, text: 'Він каже це кожному. Але сьогодні — щиро.' },
  ]);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [feed]);

  const ask = (t: Topic) => {
    if (busy) return;
    setBusy(true);
    setSeen((s) => ({ ...s, [t.q]: true }));
    setFeed((f) => [...f, { who: 'ТИ', text: t.q }]);
    t.lines.forEach((ln, i) => setTimeout(() => {
      setFeed((f) => [...f, ln]);
      if (i === t.lines.length - 1) setBusy(false);
    }, 420 * (i + 1)));
  };

  return (
    <>
      <Bg src={BG.front} blur />
      <div className="ob-de">
        <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 3 }}>
          <button className="ob-back" onClick={onBack}>← вихід</button>
        </div>
        <div className="ob-de-feed">
          {feed.map((ln, i) => (
            <div key={i} className={'ob-de-line' + (ln.who === 'ТИ' ? ' me' : '') + (ln.voice ? ' voice' : '')}>
              <div className="nm">{ln.who}</div>
              <p>{ln.text}</p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="ob-de-opts">
          {TOPICS.map((t, i) => (
            <button key={t.q} className={'ob-de-opt' + (seen[t.q] ? ' seen' : '')} onClick={() => ask(t)}>
              <span className="i">{i + 1}.</span>{t.q}
            </button>
          ))}
          <button className="ob-de-opt cta" onClick={onDone}>
            <span className="i">{TOPICS.length + 1}.</span>[Записуй мене. Я граю.]
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- E · Persona/VN: одна репліка на екран, «далі ▸» ----------
   Серія реплік гортається кнопкою; емоція героя міняється на кожній
   репліці (мітка = майбутній спрайт); між серіями — вибір теми. */
function Vn({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [li, setLi] = useState(0);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const line = topic?.lines[li];
  const left = TOPICS.filter((t) => !seen[t.q]);

  const pick = (t: Topic) => { setSeen((s) => ({ ...s, [t.q]: true })); setTopic(t); setLi(0); };
  const adv = () => { if (!topic) return; li < topic.lines.length - 1 ? setLi(li + 1) : setTopic(null); };

  return (
    <>
      <Bg src={BG.close} />
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 3 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      <div className="ob-vn">
        {line ? (
          <>
            <div className="ob-vn-mood"><b>{line.who}</b>{line.mood && <span>· {line.mood}</span>}{line.voice && <span>· голос</span>}</div>
            <div className="ob-vn-say" key={li} style={line.voice ? { fontStyle: 'italic', background: '#efe8ff' } : undefined}>
              {line.text}
            </div>
            <button className="ob-vn-adv" onClick={adv}>
              {li < (topic!.lines.length - 1) ? <>далі <span className="tri">▸</span></> : 'до питань ▾'}
            </button>
            <div className="ob-vn-steps">
              {topic!.lines.map((_, i) => <i key={i} className={i <= li ? 'on' : ''} />)}
            </div>
          </>
        ) : (
          <>
            <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· слухає</span></div>
            <div className="ob-vn-say">{left.length ? 'Що ще розказати?' : 'Ну що, я все розповів. Твій хід.'}</div>
            <div className="ob-qs">
              {left.map((t) => (
                <button key={t.q} className="ob-q" onClick={() => pick(t)}><span className="qm">?</span>{t.q}</button>
              ))}
              <button className="ob-next" onClick={onDone}>Зареєструватися →</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- F · Pokémon textbox: typewriter + ▼, серія боксів ----------
   Нижній бокс, текст друкується по літерах; тап по боксу: недодрукований
   текст доводиться миттєво, далі — наступна репліка серії; меню тем у боксі. */
function Poke({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [topic, setTopic] = useState<Topic | null>(null);
  const [li, setLi] = useState(0);
  const [chars, setChars] = useState(0);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const line = topic?.lines[li];
  const fullyTyped = !!line && chars >= line.text.length;

  useEffect(() => {
    if (!line) return;
    setChars(0);
    const t = setInterval(() => setChars((c) => {
      if (c >= line.text.length) { clearInterval(t); return c; }
      return c + 2;
    }), 24);
    return () => clearInterval(t);
  }, [line]);

  const tapBox = () => {
    if (!topic || !line) return;
    if (!fullyTyped) { setChars(line.text.length); return; }
    li < topic.lines.length - 1 ? setLi(li + 1) : setTopic(null);
  };
  const pick = (t: Topic) => { setSeen((s) => ({ ...s, [t.q]: true })); setTopic(t); setLi(0); };

  return (
    <>
      <Bg src={BG.terrace} />
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 3 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      <div className="ob-pk">
        {line ? (
          <div className="ob-pk-box" onClick={tapBox}>
            <span className="nm">{line.who}</span>
            <p>{line.text.slice(0, chars)}</p>
            {fullyTyped && <span className="ob-pk-cur">▼</span>}
          </div>
        ) : (
          <div className="ob-pk-box">
            <span className="nm">ЯРЕМА</span>
            <p>Про що розказати?</p>
            <div className="ob-pk-menu">
              {TOPICS.map((t) => (
                <button key={t.q} className={'ob-pk-item' + (seen[t.q] ? ' seen' : '')} onClick={() => pick(t)}>
                  <span className="ar">▸</span>{t.q}{seen[t.q] ? ' ✓' : ''}
                </button>
              ))}
              <button className="ob-pk-item cta" onClick={onDone}><span className="ar">▸</span>ЗАПИСУЙ МЕНЕ!</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- Хаб ---------- */
export default function OnbLab() {
  const [v, setV] = useState<'hub' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'stub'>('hub');
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
            <button className="ob-hub-btn" onClick={() => setV('d')}>
              <span className="n">D</span>
              <span><b>Стрічка-скрипт</b><span>реф Disco Elysium: серії реплік + голоси речей</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('e')}>
              <span className="n">E</span>
              <span><b>Візуальна новела</b><span>реф Persona: репліка за реплікою, «далі ▸», емоції</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('f')}>
              <span className="n">F</span>
              <span><b>Текстбокс</b><span>реф Pokémon: друк по літерах + ▼, меню в боксі</span></span>
            </button>
          </div>
        </>
      )}
      {v === 'a' && <Dialog key="a" single onBack={back} onDone={done} />}
      {v === 'b' && <Dialog key="b" single={false} onBack={back} onDone={done} />}
      {v === 'c' && <Chat key="c" onBack={back} onDone={done} />}
      {v === 'd' && <Disco key="d" onBack={back} onDone={done} />}
      {v === 'e' && <Vn key="e" onBack={back} onDone={done} />}
      {v === 'f' && <Poke key="f" onBack={back} onDone={done} />}
      {v === 'stub' && <Stub onBack={back} />}
    </div></main>
  );
}

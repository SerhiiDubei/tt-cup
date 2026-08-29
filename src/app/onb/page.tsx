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

/* ---------- Спільний typewriter-бокс серії реплік (стиль F) ----------
   Тап: недодруковане доводиться миттєво → наступна теза → onEnd. */
function TypeSeq({ lines, onEnd, extra }: { lines: Line[]; onEnd: () => void; extra?: React.ReactNode }) {
  const [li, setLi] = useState(0);
  const [chars, setChars] = useState(0);
  const line = lines[li];
  const typed = chars >= line.text.length;
  useEffect(() => {
    setChars(0);
    const t = setInterval(() => setChars((c) => (c >= line.text.length ? c : c + 2)), 22);
    return () => clearInterval(t);
  }, [line]);
  const tap = () => {
    if (!typed) { setChars(line.text.length); return; }
    if (li < lines.length - 1) setLi(li + 1); else onEnd();
  };
  return (
    <div className="ob-pk-box" onClick={tap}>
      <span className="nm">{line.who}</span>
      <p style={line.voice ? { fontStyle: 'italic', opacity: 0.85 } : undefined}>{line.text.slice(0, chars)}</p>
      {typed && li < lines.length - 1 && <span className="ob-pk-cur">▼</span>}
      {typed && li === lines.length - 1 && (extra ?? <span className="ob-pk-cur">▼</span>)}
    </div>
  );
}

/* ---------- G · Мапа світу (реф Super Mario World) ----------
   Вузли на стежці, фішка-мʼячик переїжджає, пройдене — лайм,
   наступне відкривається; тема відкривається лише на активному вузлі. */
const MAP_POS = [
  { x: 50, y: 12 }, { x: 24, y: 27 }, { x: 71, y: 41 }, { x: 27, y: 56 }, { x: 71, y: 70 },
];
const MAP_FIN = { x: 50, y: 86 };
function WorldMap({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(false);
  const pawn = done < MAP_POS.length ? MAP_POS[done] : MAP_FIN;
  const pts = [...MAP_POS, MAP_FIN].map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <>
      <Bg src={BG.front} blur />
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 6 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      <div className="ob-map">
        <svg className="ob-map-path" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke="rgba(255,248,236,0.55)" strokeWidth="1.1"
            strokeDasharray="2.6 2.2" strokeLinecap="round" />
        </svg>
        {MAP_POS.map((p, i) => (
          <button key={i}
            className={'ob-map-node' + (i < done ? ' done' : i === done ? ' now' : ' lock')}
            style={{ left: p.x + '%', top: p.y + '%' }}
            onClick={() => i === done && setOpen(true)}>
            {i < done ? '✓' : i + 1}
            <small>{TOPICS[i].q}</small>
          </button>
        ))}
        <button className={'ob-map-node fin' + (done === MAP_POS.length ? ' now' : ' lock')}
          style={{ left: MAP_FIN.x + '%', top: MAP_FIN.y + '%' }}
          onClick={() => done === MAP_POS.length && onDone()}>
          СТАРТ<small>реєстрація</small>
        </button>
        <div className="ob-map-pawn" style={{ left: pawn.x + '%', top: pawn.y + '%' }} />
        {open && done < MAP_POS.length && (
          <div className="ob-seq">
            <TypeSeq lines={TOPICS[done].lines} onEnd={() => { setOpen(false); setDone(done + 1); }} />
          </div>
        )}
      </div>
    </>
  );
}

/* ---------- H · Туман війни (реф Zelda BotW / Civilization) ----------
   Двір закритий туман-зонами; відповів на тему — зона проявляється.
   Дізнатися правила = буквально відкрити локацію. */
const FOG_ZONES = [
  { x: 4, y: 10, w: 44, h: 18 }, { x: 52, y: 10, w: 44, h: 18 },
  { x: 4, y: 31, w: 92, h: 15 }, { x: 4, y: 49, w: 44, h: 16 }, { x: 52, y: 49, w: 44, h: 16 },
];
function Fog({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [open, setOpen] = useState<boolean[]>(Array(FOG_ZONES.length).fill(false));
  const [cur, setCur] = useState<number | null>(null);
  const allOpen = open.every(Boolean);
  return (
    <>
      <Bg src={BG.front} />
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 6 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      {FOG_ZONES.map((z, i) => (
        <button key={i}
          className={'ob-fog-zone' + (open[i] ? ' open' : '')}
          style={{ left: z.x + '%', top: z.y + '%', width: z.w + '%', height: z.h + '%', zIndex: 3 }}
          onClick={() => !open[i] && cur === null && setCur(i)}>
          <span className="qmark">?</span>
          <span className="zt">{TOPICS[i].q}</span>
        </button>
      ))}
      {FOG_ZONES.map((z, i) => open[i] && (
        <span key={'p' + i} className="ob-fog-pin" style={{ left: (z.x + z.w / 2) + '%', top: (z.y + z.h / 2) + '%' }}>
          ✓ {TOPICS[i].q}
        </span>
      ))}
      {allOpen && cur === null && (
        <div className="ob-fog-cta"><button className="ob-next" onClick={onDone}>Зареєструватися →</button></div>
      )}
      {cur !== null && (
        <div className="ob-seq" style={{ position: 'absolute', zIndex: 6 }}>
          <TypeSeq lines={TOPICS[cur].lines}
            onEnd={() => { setOpen((o) => o.map((v, i) => (i === cur ? true : v))); setCur(null); }} />
        </div>
      )}
    </>
  );
}

/* ---------- I · Настілка (реф Mario Party / гусек) ----------
   Фішка їде клітинками по дошці; на зупинках — серія тез + ОДНОРАЗОВІ
   реакції-відповіді (використана зникає назавжди — механіка E). */
const BD_CELLS = [
  { x: 18, y: 14 }, { x: 50, y: 20 }, { x: 80, y: 30 }, { x: 50, y: 42 },
  { x: 20, y: 52 }, { x: 46, y: 63 }, { x: 76, y: 74 },
];
const REACTIONS = [
  { r: 'Ого, серйозно?', a: 'Серйозніше нікуди. Ну, майже.' },
  { r: 'Звучить просто.', a: 'Бо воно і є просто. Складне ми лишили собі.' },
  { r: 'А якщо я нуб?', a: 'Ідеально. Нижня сітка створена для майбутніх легенд.' },
  { r: 'Покажи вже фінал.', a: 'Терпіння. Спочатку дограй цю дошку.' },
  { r: 'Мені вже подобається.', a: 'Це двір так діє. На всіх.' },
  { r: 'Хто це все придумав?', a: 'Двір. Я лише записав.' },
];
function Board({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [pos, setPos] = useState(0);           // 0 = старт-клітинка
  const [phase, setPhase] = useState<'idle' | 'seq' | 'react'>('idle');
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [echo, setEcho] = useState<string | null>(null);
  const topic = pos >= 1 && pos <= 5 ? TOPICS[pos - 1] : null;
  const freeReacts = REACTIONS.filter((x) => !used[x.r]).slice(0, 2);
  const roll = () => {
    const np = pos + 1;
    setPos(np); setEcho(null);
    if (np <= 5) setTimeout(() => setPhase('seq'), 750); else setPhase('idle');
  };
  const react = (x: { r: string; a: string }) => { setUsed((u) => ({ ...u, [x.r]: true })); setEcho(x.a); };
  return (
    <>
      <Bg src={BG.terrace} blur />
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 6 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      {BD_CELLS.map((c, i) => (
        <span key={i} className={'ob-bd-cell' + (i >= 1 && i <= 5 ? ' ev' : '') + (i < pos ? ' done' : '')}
          style={{ left: c.x + '%', top: c.y + '%', zIndex: 2 }}>
          {i === 0 ? '🏁' : i <= 5 ? (i < pos ? '✓' : i) : ''}
          {i === 6 ? 'ФІНІШ' : ''}
        </span>
      ))}
      <div className="ob-map-pawn" style={{ left: BD_CELLS[Math.min(pos, 6)].x + '%', top: BD_CELLS[Math.min(pos, 6)].y + '%', zIndex: 3 }} />
      {phase === 'seq' && topic && (
        <div className="ob-seq" style={{ zIndex: 6 }}>
          <TypeSeq lines={echo ? [{ who: 'ЯРЕМА', text: echo }] : topic.lines}
            onEnd={() => { if (echo) { setPhase('idle'); } else { setPhase('react'); } }} />
        </div>
      )}
      {phase === 'react' && topic && (
        <div className="ob-seq" style={{ zIndex: 6 }}>
          <div className="ob-pk-box">
            <span className="nm">ТВОЯ РЕАКЦІЯ</span>
            <div className="ob-react">
              {freeReacts.map((x) => (
                <button key={x.r} onClick={() => { react(x); setPhase('seq'); }}>
                  <span className="ar">▸</span>{x.r}
                </button>
              ))}
              <button onClick={() => setPhase('idle')}><span className="ar">▸</span>Їдемо далі →</button>
            </div>
          </div>
        </div>
      )}
      {phase === 'idle' && (
        <div className="ob-bd-roll">
          {pos < 6
            ? <button className="ob-next" onClick={roll}>ХІД →</button>
            : <button className="ob-next lime" onClick={onDone}>ФІНІШ! Зареєструватися →</button>}
        </div>
      )}
    </>
  );
}

/* ---------- J · VN 2.0 (ФІКСОВАНИЙ ПІДХІД): чаптери + зміна задника ----------
   Кожен розділ = своя локація; перехід — титул розділу + zoom-in/розмиття
   нового задника (голосова 2026-08-29). Всередині — VN-механіка E + вкраплення
   одноразових реакцій. */
type Block = { kind: 'lines'; lines: Line[] } | { kind: 'react'; prompt: string };
type Chapter = { ch: string; nm: string; bg: string; blocks: Block[] };

const CHAPTERS: Chapter[] = [
  {
    ch: 'Розділ 1', nm: 'Двір', bg: BG.front,
    blocks: [
      { kind: 'lines', lines: [
        { who: 'ЯРЕМА', mood: 'інтрига', text: 'Бачиш цей стіл? Один. На весь двір.' },
        { who: 'ЯРЕМА', mood: 'впевнений', text: 'Мене звати Ярема. Я тут живу.' },
        { who: 'ЯРЕМА', mood: 'пояснює', text: 'Скоро тут — Druid Battle Cup. Дві фази: онлайн зараз, фінал наживо.' },
        { who: 'ДВІР', voice: true, text: 'Він каже це кожному. Але сьогодні — щиро.' },
      ] },
      { kind: 'react', prompt: 'Твоя реакція?' },
    ],
  },
  {
    ch: 'Розділ 2', nm: 'Стіл', bg: BG.close,
    blocks: [
      { kind: 'lines', lines: [
        { who: 'ЯРЕМА', mood: 'пояснює', text: 'Система сама збере сітку й дасть тобі вісім суперників.' },
        { who: 'ЯРЕМА', mood: 'спокій', text: 'Нік суперника — в телеграмі. Списуєтесь і граєте, коли зручно обом.' },
        { who: 'СТІЛ', voice: true, text: 'Минулого тижня двоє грали о пів на першу ночі. Я не проти.' },
        { who: 'ЯРЕМА', mood: 'підбадьорює', text: 'За перемоги — очки: верхня чи нижня сітка. Але грають усі до кінця.' },
        { who: 'ЯРЕМА', mood: 'чесно', text: 'Суперник зник? Матч не рахується, саппорт розрулить. І так — реєстрація безкоштовна.' },
      ] },
      { kind: 'react', prompt: 'Питання є?' },
    ],
  },
  {
    ch: 'Розділ 3', nm: 'День Х', bg: BG.terrace,
    blocks: [
      { kind: 'lines', lines: [
        { who: 'ЯРЕМА', mood: 'хайп', text: '12 вересня. Тут. Столи в ряд, повний двір людей.' },
        { who: 'ЯРЕМА', mood: 'пояснює', text: 'Приходиш зі своєю позицією з онлайн-фази — і граєш наживо.' },
        { who: 'ЯРЕМА', mood: 'хайп', text: 'Плюс міні-ігри: стаканчики, відро, ще купа приколів.' },
        { who: 'ЯРЕМА', mood: 'запрошує', text: 'Твоя черга.' },
      ] },
    ],
  },
];

function Vn2({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [ci, setCi] = useState(0);            // чаптер
  const [stage, setStage] = useState<'title' | 'play'>('title');
  const [bi, setBi] = useState(0);            // блок у чаптері
  const [li, setLi] = useState(0);            // лінія у блоці
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [echo, setEcho] = useState<Line | null>(null);
  const chap = CHAPTERS[ci];
  const block = chap.blocks[bi];

  useEffect(() => {
    if (stage !== 'title') return;
    const t = setTimeout(() => setStage('play'), 1500);
    return () => clearTimeout(t);
  }, [stage, ci]);

  const nextBlock = () => {
    setEcho(null); setLi(0);
    if (bi < chap.blocks.length - 1) { setBi(bi + 1); return; }
    if (ci < CHAPTERS.length - 1) { setCi(ci + 1); setBi(0); setStage('title'); return; }
    onDone();
  };
  const adv = () => {
    if (echo) { setEcho(null); nextBlock(); return; }
    if (block.kind !== 'lines') return;
    li < block.lines.length - 1 ? setLi(li + 1) : nextBlock();
  };
  const line = echo ?? (block.kind === 'lines' ? block.lines[li] : null);
  const freeReacts = REACTIONS.filter((x) => !used[x.r]).slice(0, 2);
  const last = ci === CHAPTERS.length - 1 && bi === chap.blocks.length - 1
    && block.kind === 'lines' && li === block.lines.length - 1 && !echo;

  return (
    <>
      <div className="vn2-bgs">
        {CHAPTERS.map((c, i) => (
          <div key={i} className={'ob-bg' + (i === ci ? ' on' : '')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.bg} alt="" />
          </div>
        ))}
      </div>
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 6 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
        <div className="ob-dots">
          {CHAPTERS.map((c, i) => <span key={i} className={'ob-dot' + (i === ci ? ' on' : i < ci ? ' done' : '')} />)}
        </div>
      </div>

      {stage === 'title' && (
        <div className="vn2-title" onClick={() => setStage('play')}>
          <div className="card"><div className="ch">{chap.ch}</div><div className="nm">{chap.nm}</div></div>
        </div>
      )}

      {stage === 'play' && (
        <div className="ob-vn">
          {line && (
            <>
              <div className="ob-vn-mood">
                <b>{line.who}</b>{line.mood && <span>· {line.mood}</span>}{line.voice && <span>· голос</span>}
              </div>
              <div className="ob-vn-say" key={ci + '-' + bi + '-' + li + (echo ? '-e' : '')}
                style={line.voice ? { fontStyle: 'italic', background: '#efe8ff' } : undefined}>
                {line.text}
              </div>
              {last
                ? <button className="ob-next" onClick={onDone}>Зареєструватися →</button>
                : <button className="ob-vn-adv" onClick={adv}>далі <span className="tri">▸</span></button>}
              {block.kind === 'lines' && !echo && (
                <div className="ob-vn-steps">
                  {block.lines.map((_, i) => <i key={i} className={i <= li ? 'on' : ''} />)}
                </div>
              )}
            </>
          )}
          {!line && block.kind === 'react' && (
            <>
              <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· слухає</span></div>
              <div className="ob-vn-say">{block.prompt}</div>
              <div className="ob-qs">
                {freeReacts.map((x) => (
                  <button key={x.r} className="ob-q"
                    onClick={() => { setUsed((u) => ({ ...u, [x.r]: true })); setEcho({ who: 'ЯРЕМА', text: x.a }); }}>
                    <span className="qm">?</span>{x.r}
                  </button>
                ))}
                <button className="ob-q ghost" onClick={nextBlock}>Далі →</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- K · Ізо-стежка (реф Monument Valley) ----------
   Ізометричні плитки; фішка їде точками, КОЖНА ТОЧКА ПЕРЕМИКАЄ ЗАДНИК. */
const ISO_CELLS = [
  { r: 0, c: 0 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 2, c: 1 }, { r: 3, c: 1 }, { r: 3, c: 2 },
];
const ISO_BGKEYS = [BG.front, BG.close, BG.terrace];
function IsoPath({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(false);
  const T = 72;
  const pos = (i: number) => ({ left: ISO_CELLS[i].c * T + 'px', top: ISO_CELLS[i].r * T + 'px' });
  const active = Math.min(done, 5);
  return (
    <>
      <div className="iso-bgs">
        {ISO_BGKEYS.map((b, i) => (
          <div key={i} className={'ob-bg' + (i === active % 3 ? ' on' : '')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b} alt="" />
          </div>
        ))}
      </div>
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 6 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      <div className="iso-cap">{done < 5 ? TOPICS[done].q : 'СТАРТ · реєстрація'}</div>
      <div className="iso-scene">
        <div className="iso-plane" style={{ width: 3 * T + 62, height: 4 * T + 62 }}>
          {ISO_CELLS.map((cell, i) => (
            <div key={i} className={'iso-tile' + (i === 5 ? ' fin' : i < done ? ' done' : i === done ? ' ev' : ' dim')}
              style={pos(i)}>
              <span className="iso-stand">
                <button
                  className={'iso-node' + (i === 5 ? ' fin' : i < done ? ' done' : i === done ? ' now' : '')}
                  onClick={() => { if (i !== done) return; i === 5 ? onDone() : setOpen(true); }}>
                  {i === 5 ? 'СТАРТ' : i < done ? '✓' : i + 1}
                </button>
              </span>
            </div>
          ))}
          <div className="iso-pawncell" style={pos(active)}>
            <span className="iso-stand" style={{ transform: 'translate(-50%,-210%) rotateZ(-45deg) rotateX(-56deg)' }}>
              <span className="iso-ball" style={{ display: 'block' }} />
            </span>
          </div>
        </div>
      </div>
      {open && done < 5 && (
        <div className="ob-seq" style={{ zIndex: 7 }}>
          <TypeSeq lines={TOPICS[done].lines} onEnd={() => { setOpen(false); setDone(done + 1); }} />
        </div>
      )}
    </>
  );
}

/* ---------- L · Новела 2.1: хотспоти-предмети (тап по предмету в кадрі) ----------
   Задники = піксель-таймлапс монумента зі STORYBOARD/90_experiments (стиль юзера,
   ранок→день→вечір), предмети = згенеровані PNG у тому ж fatpixel-стилі
   (білий фон знято в альфу), полароїд-вставки = кольорові кадри 80_output. */
type PxChap = {
  ch: string; nm: string; bg: string; photo: string; cap: string;
  obj: { img: string; x: number; y: number; w: number };
  intro: string; found: string;
};
const PX_CHAPTERS: PxChap[] = [
  {
    ch: 'Ранок', nm: 'Розминка', bg: '/onb/px/px-morning.jpg', photo: '/onb/px/ph-drink.jpg', cap: 'двір прокидається',
    obj: { img: '/onb/px/obj-paddle.png', x: 62, y: 30, w: 96 },
    intro: 'Ранок. Хтось лишив ракетку просто в кадрі. Бачиш? Тапни її.',
    found: 'Тримай. Це тепер твоя. Перший предмет у кишені гравця.',
  },
  {
    ch: 'День', nm: 'Матчі', bg: '/onb/px/px-noon.jpg', photo: '/onb/px/ph-strike.jpg', cap: 'онлайн-фаза',
    obj: { img: '/onb/px/obj-ball.png', x: 20, y: 36, w: 74 },
    intro: 'День. Вісім матчів, суперники в телеграмі, граєш коли зручно. Мʼяч утік — злови його.',
    found: 'Є! З таким контролем нижня сітка тобі не загрожує. Ну, майже.',
  },
  {
    ch: 'Вечір', nm: 'День Х', bg: '/onb/px/px-dusk.jpg', photo: '/onb/px/ph-win.jpg', cap: '12 вересня · фінал',
    obj: { img: '/onb/px/obj-cups.png', x: 58, y: 52, w: 104 },
    intro: '12 вересня — фінал наживо: столи, люди, міні-ігри. Стаканчики вже сховались — знайди.',
    found: 'Повний комплект. Лишилось одне — твоє імʼя в сітці.',
  },
];

function Vn3({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [ci, setCi] = useState(0);
  const [stage, setStage] = useState<'title' | 'seek' | 'found'>('title');
  const [got, setGot] = useState<boolean[]>([false, false, false]);
  const [popping, setPopping] = useState(false);
  const chap = PX_CHAPTERS[ci];
  const isLast = ci === PX_CHAPTERS.length - 1;

  useEffect(() => {
    if (stage !== 'title') return;
    const t = setTimeout(() => setStage('seek'), 1400);
    return () => clearTimeout(t);
  }, [stage, ci]);

  const grab = () => {
    if (popping) return;
    setPopping(true);
    setTimeout(() => {
      setGot((g) => g.map((v, i) => (i === ci ? true : v)));
      setPopping(false); setStage('found');
    }, 480);
  };
  const next = () => { isLast ? onDone() : (setCi(ci + 1), setStage('title')); };

  return (
    <>
      <div className="vn2-bgs">
        {PX_CHAPTERS.map((c, i) => (
          <div key={i} className={'ob-bg' + (i === ci ? ' on' : '')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.bg} alt="" />
          </div>
        ))}
      </div>
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 6 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
      </div>
      <div className="px-inv">
        {PX_CHAPTERS.map((c, i) => (
          <span key={i} className={'px-slot' + (got[i] ? '' : ' empty')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {got[i] && <img src={c.obj.img} alt="" />}
          </span>
        ))}
      </div>

      {stage === 'title' && (
        <div className="vn2-title" onClick={() => setStage('seek')}>
          <div className="card"><div className="ch">{chap.ch}</div><div className="nm">{chap.nm}</div></div>
        </div>
      )}

      {stage !== 'title' && (
        <>
          {stage === 'seek' && (
            <button className={'px-obj' + (popping ? ' got' : '')}
              style={{ left: chap.obj.x + '%', top: chap.obj.y + '%', width: chap.obj.w }}
              onClick={grab} aria-label="предмет">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chap.obj.img} alt="" />
            </button>
          )}
          <div className="px-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chap.photo} alt="" /><span>{chap.cap}</span>
          </div>
          <div className="ob-vn" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 0, zIndex: 5 }}>
            <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· {stage === 'seek' ? 'шукай' : 'задоволений'}</span></div>
            <div className="ob-vn-say" key={ci + stage}>{stage === 'seek' ? chap.intro : chap.found}</div>
            {stage === 'found' && (
              isLast
                ? <button className="ob-next" onClick={onDone}>Зареєструватися →</button>
                : <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- M · ФІНАЛ · PIXEL EDITION ----------
   Все у fatpixel-стилі (реф states8 + таймлапс). Лінійні біти з частою зміною
   планів і механік, узятих з реальних візуальних новел:
   - Danganronpa: investigation/find-object (мʼяч захований у сцені, без хінта)
   - Ace Attorney: «предʼяви доказ» з інвентаря
   - Telltale: timed choice з таймером
   - Professor Layton: пазл-питання між діалогами
   + предметні макро-плани і 2-кадрова анімація ралі. */
const PXE = '/onb/pxe/';
type Bit =
  | { t: 'title'; ch: string; nm: string; bg: string }
  | { t: 'line'; bg: string; who: string; mood?: string; voice?: boolean; text: string }
  | { t: 'anim'; bgs: string[]; text: string }
  | { t: 'react'; bg: string; prompt: string }
  | { t: 'find'; bg: string; zone: { x: number; y: number; w: number; h: number }; obj: string; intro: string; found: string; missTxt: string }
  | { t: 'timed'; bg: string; q: string; opts: [string, string]; a: [string, string] }
  | { t: 'puzzle'; bg: string; q: string; opts: number[]; right: number; win: string; lose: string }
  | { t: 'evidence'; bg: string; q: string; right: string; win: string; lose: string }
  | { t: 'game'; bg: string };

const BITS: Bit[] = [
  { t: 'title', ch: 'Розділ 1', nm: 'Двір', bg: PXE + 'bg-yard.jpg' },
  { t: 'line', bg: PXE + 'bg-yard.jpg', who: 'ЯРЕМА', mood: 'інтрига', text: 'Бачиш цей двір? Тут скоро буде Druid Battle Cup.' },
  { t: 'anim', bgs: [PXE + 'bg-rally-a.jpg', PXE + 'bg-rally-b.jpg'], text: 'Онлайн-фаза вже гріється: матчі йдуть щодня, коли зручно гравцям.' },
  { t: 'line', bg: PXE + 'bg-table.jpg', who: 'ЯРЕМА', mood: 'пояснює', text: 'Система збере сітку сама і дасть тобі вісім суперників. Нік — у телеграмі.' },
  { t: 'line', bg: PXE + 'bg-table.jpg', who: 'СТІЛ', voice: true, text: 'Суперник зник? Матч не рахується. Я все бачу, саппорт усе розрулить.' },
  { t: 'react', bg: PXE + 'bg-table.jpg', prompt: 'Твоя реакція?' },
  { t: 'title', ch: 'Розділ 2', nm: 'Розслідування', bg: PXE + 'bg-hidden.jpg' },
  { t: 'find', bg: PXE + 'bg-hidden.jpg', zone: { x: 24, y: 82, w: 30, h: 17 }, obj: PXE + 'obj-bucket.png',
    intro: 'Мʼяч закотився кудись у траву. Знайди його — тапни там, де він.',
    found: 'Око — алмаз! Забирай у кишеню.', missTxt: 'НЕ ТАМ' },
  { t: 'timed', bg: PXE + 'bg-macro-paddle.jpg', q: 'Швидко! Мʼяч летить на тебе — форхенд чи бекхенд?!',
    opts: ['Форхенд', 'Бекхенд'], a: ['Класика. Поважаю.', 'Ризиково. Але красиво.'] },
  { t: 'title', ch: 'Розділ 3', nm: 'Вечір', bg: PXE + 'bg-evening.jpg' },
  { t: 'line', bg: PXE + 'bg-evening.jpg', who: 'ЯРЕМА', mood: 'спокій', text: 'Онлайн-фаза триває кілька тижнів. Очки ведуть у верхню чи нижню сітку — грають усі.' },
  { t: 'puzzle', bg: PXE + 'bg-evening.jpg', q: 'Перевірка уважності: скільки матчів у тебе в онлайн-фазі?',
    opts: [6, 8, 10], right: 8, win: 'Вісім! Слухав уважно — таких ми любимо.', lose: 'Нє-а. Я ж казав…' },
  { t: 'title', ch: 'Розділ 4', nm: 'День Х', bg: PXE + 'bg-night.jpg' },
  { t: 'line', bg: PXE + 'bg-night.jpg', who: 'ЯРЕМА', mood: 'хайп', text: '12 вересня. Фінал наживо: столи в ряд, гірлянди, повний двір людей.' },
  { t: 'anim', bgs: [PXE + 'bg-macro-cups.jpg', PXE + 'bg-night.jpg'], text: 'І міні-ігри: стаканчики, відро — легенди складають не тільки про чемпіонів.' },
  { t: 'evidence', bg: PXE + 'bg-night.jpg', q: 'Стоп! Предʼяви доказ, що ти готовий до Дня Х.',
    right: 'paddle', win: 'ПРОТЕСТУ НЕМАЄ! Ракетка — це вже пів перемоги.', lose: 'Хм. Це знадобиться, але не воно…' },
  { t: 'title', ch: 'Розділ 5', nm: 'Перевірка', bg: PXE + 'bg-yard.jpg' },
  { t: 'game', bg: PXE + 'bg-yard.jpg' },
];

/* Гра-сортування: 8 РІЗНИХ згенерованих персонажів (fatpixel). */
const FG_CHARS = [
  { name: 'Батрайдер', img: PXE + 'ch-batrider.png' },
  { name: 'Влад', img: PXE + 'ch-vlad.png' },
  { name: 'Ліза', img: PXE + 'ch-liza.png' },
  { name: 'Настя', img: PXE + 'ch-nastia.png' },
  { name: 'Олег', img: PXE + 'ch-oleg.png' },
  { name: 'Оля', img: PXE + 'ch-olia.png' },
  { name: 'Стас', img: PXE + 'ch-stas.png' },
  { name: 'Ярема', img: PXE + 'ch-yarema.png' },
];
const FG_POOL_ORDER = [4, 1, 7, 0, 5, 2, 6, 3];

function SortGame({ onWin }: { onWin: () => void }) {
  const [slots, setSlots] = useState<(number | null)[]>(Array(8).fill(null));
  const [wrong, setWrong] = useState<boolean[]>(Array(8).fill(false));
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<{ idx: number; x: number; y: number } | null>(null);
  const inPool = FG_POOL_ORDER.filter((i) => !slots.includes(i));
  const allSet = slots.every((s) => s !== null);

  const startDrag = (idx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDrag({ idx, x: e.clientX, y: e.clientY });
  };
  useEffect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot]');
      setDrag(null);
      if (!el) return;
      const si = Number((el as HTMLElement).dataset.slot);
      setSlots((s) => {
        const ns = [...s];
        const from = ns.indexOf(drag.idx);
        if (from >= 0) ns[from] = ns[si];
        ns[si] = drag.idx;
        return ns;
      });
      setWrong(Array(8).fill(false)); setMsg('');
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [drag]);

  const check = () => {
    const sorted = [...FG_CHARS.map((c) => c.name)].sort((a, b) => a.localeCompare(b, 'uk'));
    const w = slots.map((s, i) => s !== null && FG_CHARS[s].name !== sorted[i]);
    if (w.some(Boolean)) { setWrong(w as boolean[]); setMsg('Не зовсім. Червоні — не на своїх місцях.'); }
    else { setMsg('Все чітко. Ти точно з Друїду! 🏓'); setTimeout(onWin, 900); }
  };

  return (
    <div className="fg-wrap">
      <div className="fg-title">ОСТАННЯ ПЕРЕВІРКА: ЧИ ТИ З ДРУЇДУ?
        <small>Розстав завсідників за алфавітом — тягни картку в слот (1 → 8)</small>
      </div>
      <div className="fg-slots">
        {slots.map((s, i) => (
          <div key={i} data-slot={i}
            className={'fg-slot' + (s !== null ? ' filled' : '') + (wrong[i] ? ' wrong' : '')}>
            <span className="num">{i + 1}</span>
            {s !== null && (
              <div className="fg-char small" onPointerDown={startDrag(s)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FG_CHARS[s].img} alt="" draggable={false} />
                <b>{FG_CHARS[s].name}</b>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="fg-pool">
        {inPool.map((i) => (
          drag?.idx === i ? null : (
            <div key={i} className="fg-char" onPointerDown={startDrag(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={FG_CHARS[i].img} alt="" draggable={false} />
              <b>{FG_CHARS[i].name}</b>
            </div>
          )
        ))}
      </div>
      {drag && (
        <div className="fg-char dragging" style={{ left: drag.x, top: drag.y }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FG_CHARS[drag.idx].img} alt="" draggable={false} />
          <b>{FG_CHARS[drag.idx].name}</b>
        </div>
      )}
      <button className="ob-next fg-check" disabled={!allSet} style={!allSet ? { opacity: 0.45 } : undefined} onClick={check}>
        Перевірити
      </button>
      <div className="fg-msg">{msg}</div>
    </div>
  );
}

const PXE_BGS = Array.from(new Set(BITS.flatMap((b) => ('bgs' in b ? b.bgs : [b.bg]))));
const EVIDENCE_ITEMS = [
  { id: 'ball', img: '/onb/px/obj-ball.png', nm: 'Мʼяч' },
  { id: 'paddle', img: '/onb/px/obj-paddle.png', nm: 'Ракетка' },
  { id: 'bucket', img: PXE + 'obj-bucket.png', nm: 'Відро' },
];

function VnFinal({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [bi, setBi] = useState(0);
  const [misses, setMisses] = useState<{ x: number; y: number; n: number }[]>([]);
  const [foundObj, setFoundObj] = useState(false);
  const [echo, setEcho] = useState<string | null>(null);
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [animFrame, setAnimFrame] = useState(0);
  const [timerRun, setTimerRun] = useState(false);
  const [inv, setInv] = useState<string[]>([]);
  const [wrongPz, setWrongPz] = useState<number | null>(null);
  const bit = BITS[bi];
  const curBg = 'bgs' in bit ? bit.bgs[animFrame % bit.bgs.length] : bit.bg;

  const next = () => { setEcho(null); setMisses([]); setFoundObj(false); setWrongPz(null); setBi((i) => Math.min(i + 1, BITS.length - 1)); };

  /* титул сам гортається; анімація ралі — перемикання кадрів */
  useEffect(() => {
    if (bit.t === 'title') { const t = setTimeout(next, 1400); return () => clearTimeout(t); }
    if (bit.t === 'anim') { const t = setInterval(() => setAnimFrame((f) => f + 1), 420); return () => clearInterval(t); }
    if (bit.t === 'timed') { const t = setTimeout(() => setTimerRun(true), 60); const to = setTimeout(() => setEcho((e) => e ?? bit.a[0]), 5200); return () => { clearTimeout(t); clearTimeout(to); setTimerRun(false); }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bi]);

  const freeReacts = REACTIONS.filter((x) => !used[x.r]).slice(0, 2);

  const tapFind = (e: React.MouseEvent<HTMLElement>) => {
    if (bit.t !== 'find' || foundObj) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    const z = bit.zone;
    if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
      setFoundObj(true); setInv((v) => [...v, 'ball']);
    } else {
      setMisses((m) => [...m.slice(-3), { x: px, y: py, n: Date.now() }]);
    }
  };

  return (
    <>
      <div className="vn2-bgs">
        {PXE_BGS.map((b) => (
          <div key={b} className={'ob-bg' + (b === curBg ? ' on' : '')} style={'bgs' in bit ? { transition: 'none' } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b} alt="" style={{
              ...(('bgs' in bit) ? { transition: 'none', transform: 'none', filter: 'none' } : null),
              ...(b.includes('bg-hidden') ? { objectPosition: '0% 62%' } : null),
            }} />
          </div>
        ))}
      </div>
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 8 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
        <div className="ob-dots">
          {[0, 6, 9, 12, 16].map((m, i) => <span key={i} className={'ob-dot' + (bi >= m && (i === 4 || bi < [0, 6, 9, 12, 16][i + 1]) ? ' on' : bi >= m ? ' done' : '')} />)}
        </div>
      </div>
      {inv.length > 0 && bit.t !== 'game' && (
        <div className="px-inv" style={{ top: 'calc(52px + env(safe-area-inset-top))' }}>
          {inv.map((o, i) => (
            <span key={i} className="px-slot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={EVIDENCE_ITEMS.find((x) => x.id === o)?.img} alt="" />
            </span>
          ))}
        </div>
      )}

      {bit.t === 'title' && (
        <div className="vn2-title" onClick={next}>
          <div className="card"><div className="ch">{bit.ch}</div><div className="nm">{bit.nm}</div></div>
        </div>
      )}

      {bit.t === 'game' && <SortGame onWin={onDone} />}

      {bit.t === 'find' && (
        <>
          <button className="fd-zone" onClick={tapFind} aria-label="шукати" />
          {misses.length >= 2 && !foundObj && (
            <span className="fd-hint" style={{ left: bit.zone.x + '%', top: bit.zone.y + '%', width: bit.zone.w + '%', height: bit.zone.h + '%' }} />
          )}
          {misses.map((m) => <span key={m.n} className="fd-miss" style={{ left: m.x + '%', top: m.y + '%' }}>{bit.missTxt}</span>)}
        </>
      )}

      {bit.t === 'find' && !foundObj && (
        <div className="fd-brief">
          <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· розслідування</span></div>
          <div className="ob-vn-say">{bit.intro}</div>
        </div>
      )}

      {bit.t !== 'title' && bit.t !== 'game' && !(bit.t === 'find' && !foundObj) && (
        <div className="ob-vn" style={{ zIndex: 6 }}>
          {bit.t === 'line' && (
            <>
              <div className="ob-vn-mood"><b>{bit.who}</b>{bit.mood && <span>· {bit.mood}</span>}{bit.voice && <span>· голос</span>}</div>
              <div className="ob-vn-say" key={bi} style={bit.voice ? { fontStyle: 'italic', background: '#efe8ff' } : undefined}>{bit.text}</div>
              <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
            </>
          )}
          {bit.t === 'anim' && (
            <>
              <div className="ob-vn-say" key={bi}>{bit.text}</div>
              <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
            </>
          )}
          {bit.t === 'react' && (
            echo ? (
              <>
                <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· відповідає</span></div>
                <div className="ob-vn-say" key={'e' + bi}>{echo}</div>
                <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
              </>
            ) : (
              <>
                <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· слухає</span></div>
                <div className="ob-vn-say">{bit.prompt}</div>
                <div className="ob-qs">
                  {freeReacts.map((x) => (
                    <button key={x.r} className="ob-q" onClick={() => { setUsed((u) => ({ ...u, [x.r]: true })); setEcho(x.a); }}>
                      <span className="qm">?</span>{x.r}
                    </button>
                  ))}
                  <button className="ob-q ghost" onClick={next}>Далі →</button>
                </div>
              </>
            )
          )}
          {bit.t === 'find' && (
            <>
              <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· задоволений</span></div>
              <div className="ob-vn-say" key={'f' + bi}>{bit.found}</div>
              <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
            </>
          )}
          {bit.t === 'timed' && (
            echo ? (
              <>
                <div className="ob-vn-say" key={'te' + bi}>{echo}</div>
                <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
              </>
            ) : (
              <>
                <div className="tm-bar"><i className={timerRun ? 'run' : ''} /></div>
                <div className="ob-vn-say">{bit.q}</div>
                <div className="pz-opts">
                  <button className="pz-opt" style={{ fontSize: 14 }} onClick={() => setEcho(bit.a[0])}>{bit.opts[0]}</button>
                  <button className="pz-opt" style={{ fontSize: 14 }} onClick={() => setEcho(bit.a[1])}>{bit.opts[1]}</button>
                </div>
              </>
            )
          )}
          {bit.t === 'puzzle' && (
            echo ? (
              <>
                <div className="ob-vn-say" key={'pe' + bi}>{echo}</div>
                <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>
              </>
            ) : (
              <>
                <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· хитро</span></div>
                <div className="ob-vn-say">{bit.q}</div>
                <div className="pz-opts">
                  {bit.opts.map((o) => (
                    <button key={o} className={'pz-opt' + (wrongPz === o ? ' no' : '')}
                      onClick={() => { o === bit.right ? setEcho(bit.win) : (setWrongPz(o), setEcho(null)); }}>
                      {o}
                    </button>
                  ))}
                </div>
                {wrongPz !== null && <div className="fg-msg">{bit.lose}</div>}
              </>
            )
          )}
          {bit.t === 'evidence' && (
            echo ? (
              <>
                <div className="ob-vn-say" key={'ee' + bi}>{echo}</div>
                {echo === bit.win && <button className="ob-vn-adv" onClick={next}>далі <span className="tri">▸</span></button>}
                {echo !== bit.win && <button className="ob-vn-adv" onClick={() => setEcho(null)}>ще раз <span className="tri">▸</span></button>}
              </>
            ) : (
              <>
                <div className="ob-vn-mood"><b>ЯРЕМА</b><span>· суворо</span></div>
                <div className="ob-vn-say">{bit.q}</div>
                <div className="ev-cards">
                  {EVIDENCE_ITEMS.map((it) => (
                    <button key={it.id} className="ev-card" onClick={() => setEcho(it.id === bit.right ? bit.win : bit.lose)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.img} alt="" /><b>{it.nm}</b>
                    </button>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      )}
    </>
  );
}

/* ---------- N · ОНБОРДИНГ 3.0 (після голосового рев'ю 29.08) ----------
   Секвенція біта: персонаж → «виростає» панель → typewriter-текст зі звуком
   → лише тоді кнопки. Спрайт позаду панелі, позиція чергується; на кадрах,
   де персонаж уже намальований — спрайта нема. Ken Burns на статичних кадрах. */
const V3 = '/onb/v3/';
const YAR: Record<string, string> = {
  intriga: V3 + 'yar-1.png', smile: V3 + 'yar-2.png', shrug: V3 + 'yar-3.png',
  hype: V3 + 'yar-4.png', strict: V3 + 'yar-5.png', wink: V3 + 'yar-7.png',
};
type B30 =
  | { t: 'title'; ch: string; nm: string; bg: string }
  | { t: 'line'; bg: string; emo: string; text: string; noHero?: boolean; side?: 'left' }
  | { t: 'anim'; bgs: string[]; emo: string; text: string; slow?: number }
  | { t: 'react'; bg: string; emo: string; prompt: string; side?: 'left' }
  | { t: 'find'; bg: string; emo: string; ball: { x: number; y: number; w: number }; intro: string; found: string }
  | { t: 'timed'; bg: string; emo: string; q: string; opts: [string, string]; a: [string, string]; noHero?: boolean }
  | { t: 'puzzle'; bg: string; emo: string; q: string; opts: number[]; right: number; win: string; lose: string; noHero?: boolean; pos?: string }
  | { t: 'evidence'; bg: string; emo: string; q: string; right: string; win: string; lose: string }
  | { t: 'game'; bg: string };

const B30S: B30[] = [
  { t: 'title', ch: 'Розділ 1', nm: 'Двір', bg: V3 + 'bg-front.jpg' },
  { t: 'line', bg: V3 + 'bg-front.jpg', emo: 'intriga', text: 'Бачиш цей стіл? Один. На весь двір. І скоро тут — Druid Battle Cup.' },
  { t: 'anim', bgs: [V3 + 'bg-rally-a.jpg', V3 + 'bg-rally-b.jpg'], emo: 'smile', slow: 560, text: 'Онлайн-фаза вже гріється: матчі йдуть щодня, коли зручно гравцям.' },
  { t: 'line', bg: V3 + 'bg-table.jpg', emo: 'intriga', side: 'left', text: 'Система збере сітку сама й дасть тобі вісім суперників. Нік — у телеграмі, граєте коли зручно обом.' },
  { t: 'react', bg: V3 + 'bg-table.jpg', emo: 'smile', prompt: 'Твоя реакція?' },
  { t: 'title', ch: 'Розділ 2', nm: 'Розслідування', bg: V3 + 'bg-find.jpg' },
  { t: 'find', bg: V3 + 'bg-find.jpg', emo: 'strict', ball: { x: 43, y: 79, w: 40 },
    intro: 'Мʼяч закотився у траву й причаївся. Придивись і тапни.',
    found: 'Око — алмаз! Забирай у кишеню, знадобиться.' },
  { t: 'timed', bg: V3 + 'bg-shoe.jpg', emo: 'hype', noHero: true, q: 'Мʼяч летить на тебе! Чим береш?',
    opts: ['Форхенд', 'Бекхенд'], a: ['Форхенд — впевнений удар. Так тримати.', 'Бекхенд — стильно і небезпечно. Наше.'] },
  { t: 'line', bg: V3 + 'bg-sad.jpg', emo: 'shrug', noHero: true, text: 'Суперник зник і не відповідає? Буває. Матч не зараховується — саппорт розрулить, ти нічого не втрачаєш.' },
  { t: 'title', ch: 'Розділ 3', nm: 'День Х', bg: V3 + 'bg-night.jpg' },
  { t: 'line', bg: V3 + 'bg-night.jpg', emo: 'hype', text: '12 вересня. Фінал наживо: столи в ряд, гірлянди, повний двір людей.' },
  { t: 'line', bg: V3 + 'bg-cups.jpg', emo: 'smile', side: 'left', text: 'І міні-ігри: стаканчики, відро — легенди складають не тільки про чемпіонів.' },
  { t: 'puzzle', bg: V3 + 'bg-timer.jpg', emo: 'intriga', noHero: true, pos: '30% 42%', q: 'Перевірка уважності: скільки матчів у онлайн-фазі?',
    opts: [6, 8, 10], right: 8, win: 'Вісім! Слухав уважно — таких ми любимо.', lose: 'Нє-а. Я ж казав…' },
  { t: 'line', bg: V3 + 'bg-boys.jpg', emo: 'wink', noHero: true, text: 'Наші вже тренуються лежати красиво. Двір чекає на тебе.' },
  { t: 'evidence', bg: V3 + 'bg-night.jpg', emo: 'strict', q: 'Стоп. Предʼяви доказ, що ти готовий до Дня Х.',
    right: 'paddle', win: 'ПРОТЕСТУ НЕМАЄ! Ракетка — пів перемоги.', lose: 'Хм. Знадобиться, але не воно…' },
  { t: 'title', ch: 'Розділ 4', nm: 'Перевірка', bg: V3 + 'bg-front.jpg' },
  { t: 'game', bg: V3 + 'bg-front.jpg' },
];
const CAST30 = [
  { name: 'Батрайдер', img: V3 + 'cast-0.png' },
  { name: 'Влад', img: V3 + 'cast-3.png' },
  { name: 'Ліза', img: V3 + 'cast-6.png' },
  { name: 'Настя', img: V3 + 'cast-4.png' },
  { name: 'Олег', img: V3 + 'cast-1.png' },
  { name: 'Оля', img: V3 + 'cast-5.png' },
  { name: 'Стас', img: V3 + 'cast-7.png' },
  { name: 'Ярема', img: V3 + 'cast-2.png' },
];
const EV30 = [
  { id: 'ball', img: V3 + 'ui-ball.png', nm: 'Мʼяч' },
  { id: 'paddle', img: '/onb/px/obj-paddle.png', nm: 'Ракетка' },
  { id: 'bucket', img: '/onb/pxe/obj-bucket.png', nm: 'Відро' },
];

/* звук друку: короткі бліпи WebAudio (після першого жесту користувача) */
let AC30: AudioContext | null = null;
function blip() {
  try {
    AC30 = AC30 ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = AC30.createOscillator(), g = AC30.createGain();
    o.type = 'square'; o.frequency.value = 620 + ((blip as unknown as { n?: number }).n = (((blip as unknown as { n?: number }).n ?? 0) + 1) % 4) * 90;
    g.gain.setValueAtTime(0.018, AC30.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC30.currentTime + 0.05);
    o.connect(g).connect(AC30.destination); o.start(); o.stop(AC30.currentTime + 0.055);
  } catch { /* без звуку */ }
}

/* Гра: чисті PNG без плейсхолдерів; імʼя показується бейджем, коли береш картку */
function Sort30({ onWin }: { onWin: () => void }) {
  const [slots, setSlots] = useState<(number | null)[]>(Array(8).fill(null));
  const [wrong, setWrong] = useState<boolean[]>(Array(8).fill(false));
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<{ idx: number; x: number; y: number } | null>(null);
  const inPool = FG_POOL_ORDER.filter((i) => !slots.includes(i));
  const allSet = slots.every((s) => s !== null);
  const startDrag = (idx: number) => (e: React.PointerEvent) => { e.preventDefault(); setDrag({ idx, x: e.clientX, y: e.clientY }); };
  useEffect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-slot]');
      setDrag(null);
      if (!el) return;
      const si = Number((el as HTMLElement).dataset.slot);
      setSlots((s) => { const ns = [...s]; const from = ns.indexOf(drag.idx); if (from >= 0) ns[from] = ns[si]; ns[si] = drag.idx; return ns; });
      setWrong(Array(8).fill(false)); setMsg('');
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [drag]);
  const check = () => {
    const sorted = [...CAST30.map((c) => c.name)].sort((a, b) => a.localeCompare(b, 'uk'));
    const w = slots.map((s, i) => s !== null && CAST30[s].name !== sorted[i]);
    if (w.some(Boolean)) { setWrong(w as boolean[]); setMsg('Не зовсім. Червоні — не на місцях.'); }
    else { setMsg('Все чітко. Ти точно з Друїду! 🏓'); setTimeout(onWin, 900); }
  };
  return (
    <div className="fg-wrap">
      <div className="fg-title">ОСТАННЯ ПЕРЕВІРКА: ЧИ ТИ З ДРУЇДУ?
        <small>Візьми людину — дізнаєшся імʼя. Розстав усіх за алфавітом (1 → 8)</small></div>
      <div className="fg-slots">
        {slots.map((s, i) => (
          <div key={i} data-slot={i} className={'fg-slot' + (s !== null ? ' filled' : '') + (wrong[i] ? ' wrong' : '')}>
            <span className="num">{i + 1}</span>
            {s !== null && (
              <div className="fg-char bare small" onPointerDown={startDrag(s)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CAST30[s].img} alt="" draggable={false} />
              </div>)}
          </div>))}
      </div>
      <div className="fg-pool">
        {inPool.map((i) => (drag?.idx === i ? null : (
          <div key={i} className="fg-char bare" onPointerDown={startDrag(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CAST30[i].img} alt="" draggable={false} />
          </div>)))}
      </div>
      {drag && (
        <>
          <div className="fg-nametag">{CAST30[drag.idx].name}</div>
          <div className="fg-char bare dragging" style={{ left: drag.x, top: drag.y }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={CAST30[drag.idx].img} alt="" draggable={false} />
          </div>
        </>)}
      <button className="v30-btn fg-check" disabled={!allSet} style={!allSet ? { opacity: 0.5 } : undefined} onClick={check}>Перевірити</button>
      <div className="fg-msg">{msg}</div>
    </div>
  );
}

function Vn30({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [bi, setBi] = useState(0);
  const [phase, setPhase] = useState<'hero' | 'panel' | 'type' | 'ready'>('hero');
  const [chars, setChars] = useState(0);
  const [echo, setEcho] = useState<string | null>(null);
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const [animF, setAnimF] = useState(0);
  const [tRun, setTRun] = useState(false);
  const [found, setFound] = useState(false);
  const [pop, setPop] = useState(false);
  const [inv, setInv] = useState<string[]>([]);
  const [wrongPz, setWrongPz] = useState<number | null>(null);
  const bit = B30S[bi];
  const curBg = 'bgs' in bit ? bit.bgs[animF % bit.bgs.length] : bit.bg;
  const ALL = Array.from(new Set(B30S.flatMap((b) => ('bgs' in b ? b.bgs : [b.bg]))));
  const next = () => { setEcho(null); setFound(false); setWrongPz(null); setPhase('hero'); setChars(0); setBi((i) => Math.min(i + 1, B30S.length - 1)); };

  /* текст поточного біта (для секвенції друку) */
  const mainText: string =
    bit.t === 'line' ? bit.text
    : bit.t === 'anim' ? bit.text
    : bit.t === 'react' ? (echo ?? bit.prompt)
    : bit.t === 'find' ? (found ? bit.found : bit.intro)
    : bit.t === 'timed' ? (echo ?? bit.q)
    : bit.t === 'puzzle' ? (echo ?? bit.q)
    : bit.t === 'evidence' ? (echo ?? bit.q)
    : '';

  /* оркестрація біта: титул довше; anim — спершу чиста сцена; далі hero→panel→type→ready */
  useEffect(() => {
    if (bit.t === 'title') { const t = setTimeout(next, 2200); return () => clearTimeout(t); }
    if (bit.t === 'game') return;
    const delays = bit.t === 'anim' ? [1400, 1650] : [250, 500];
    const t1 = setTimeout(() => setPhase('panel'), delays[0]);
    const t2 = setTimeout(() => setPhase('type'), delays[1]);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bi]);
  /* перезапуск друку на зміну echo/found */
  useEffect(() => { if (phase === 'ready' || phase === 'type') { setPhase('type'); setChars(0); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echo, found]);
  /* typewriter + звук */
  useEffect(() => {
    if (phase !== 'type') return;
    if (!mainText) { setPhase('ready'); return; }
    const t = setInterval(() => setChars((c) => {
      if (c >= mainText.length) { clearInterval(t); setPhase('ready'); return c; }
      if (c % 3 === 0) blip();
      return c + 2;
    }), 24);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mainText]);
  /* кадри анімації */
  useEffect(() => {
    if (bit.t !== 'anim') return;
    const t = setInterval(() => setAnimF((f) => f + 1), bit.slow ?? 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bi]);
  /* таймер timed-біта: стартує після появи кнопок */
  useEffect(() => {
    if (bit.t !== 'timed' || phase !== 'ready' || echo) return;
    const t = setTimeout(() => setTRun(true), 60);
    const to = setTimeout(() => setEcho((e) => e ?? bit.a[0]), 5300);
    return () => { clearTimeout(t); clearTimeout(to); setTRun(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bi, echo]);

  const freeReacts = REACTIONS.filter((x) => !used[x.r]).slice(0, 2);
  const emo = 'emo' in bit ? YAR[bit.emo] : YAR.smile;
  const noHero = ('noHero' in bit && bit.noHero) || false;
  const side = ('side' in bit && bit.side) === 'left' ? ' left' : '';
  const grab = () => { if (pop) return; setPop(true); setTimeout(() => { setInv((v) => [...v, 'ball']); setPop(false); setFound(true); }, 460); };
  const typed = mainText.slice(0, chars);
  const showPanel = phase !== 'hero' && bit.t !== 'title' && bit.t !== 'game' && !(bit.t === 'find' && !found);

  return (
    <div className="v30">
      <div className="vn2-bgs">
        {ALL.map((b) => (
          <div key={b} className={'ob-bg' + (b === curBg ? ' on' : '') + ('bgs' in bit ? '' : ' kb')}
            style={'bgs' in bit ? { transition: 'none' } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b} alt="" style={{
              ...(('bgs' in bit) ? { transition: 'none', transform: 'none', filter: 'none', animation: 'none' } : null),
              ...(('pos' in bit && bit.pos && b === bit.bg) ? { objectPosition: bit.pos } : null),
            }} />
          </div>))}
      </div>
      <div className="ob-top" style={{ position: 'absolute', width: '100%', zIndex: 8 }}>
        <button className="ob-back" onClick={onBack}>← вихід</button>
        <div className="ob-dots">
          {[0, 5, 9, 15].map((m, i, arr) => <span key={i} className={'ob-dot' + (bi >= m && (i === arr.length - 1 || bi < arr[i + 1]) ? ' on' : bi >= m ? ' done' : '')} />)}
        </div>
      </div>
      {inv.length > 0 && bit.t !== 'game' && (
        <div className="px-inv" style={{ top: 'calc(52px + env(safe-area-inset-top))' }}>
          {inv.map((o, i) => (
            <span key={i} className="v30-slot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={EV30.find((x) => x.id === o)?.img} alt="" />
            </span>))}
        </div>)}

      {bit.t === 'title' && (
        <div className="vn2-title deep" onClick={next}>
          <div className="card"><div className="ch">{bit.ch}</div><div className="nm">{bit.nm}</div></div>
        </div>)}

      {bit.t === 'game' && <Sort30 onWin={onDone} />}

      {bit.t === 'find' && !found && (
        <button className={'v30-ball subtle' + (pop ? ' got' : '')}
          style={{ left: bit.ball.x + '%', top: bit.ball.y + '%', width: bit.ball.w }} onClick={grab} aria-label="мʼяч">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={V3 + 'ui-ball-dim.png'} alt="" />
        </button>)}

      {showPanel && (
        <div className="ob-vn" style={{ zIndex: 6 }}>
          <div className="v30-panel vgrow" key={'p' + bi}>
            <span className="v30-name">ЯРЕМА</span>
            {!noHero && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className={'v30-hero' + side} key={emo + bi + (echo ? 'e' : '') + (found ? 'f' : '')} src={emo} alt="" />
            )}
            {phase === 'panel' ? '\u00A0' : typed}
            {phase === 'type' && <span className="v30-cur" />}
          </div>
          {phase === 'ready' && (
            <>
              {(bit.t === 'line' || bit.t === 'anim' || (bit.t === 'find' && found)) && (
                <button className="v30-btn v30-in" onClick={next}>далі ▸</button>)}
              {bit.t === 'react' && (echo
                ? <button className="v30-btn v30-in" onClick={next}>далі ▸</button>
                : (<div className="ob-qs">
                    {freeReacts.map((x) => (
                      <button key={x.r} className="v30-btn v30-in wiggle" style={{ fontSize: 12 }}
                        onClick={() => { setUsed((u) => ({ ...u, [x.r]: true })); setEcho(x.a); }}>{x.r}</button>))}
                    <button className="v30-btn dark v30-in" onClick={next}>Далі ▸</button>
                  </div>))}
              {bit.t === 'timed' && (echo
                ? <button className="v30-btn v30-in" onClick={next}>далі ▸</button>
                : (<><div className="tm-bar" style={{ height: 14 }}><i className={tRun ? 'run' : ''} /></div>
                    <div className="pz-opts">
                      <button className="v30-btn v30-in wiggle" style={{ fontSize: 13 }} onClick={() => setEcho(bit.a[0])}>{bit.opts[0]}</button>
                      <button className="v30-btn v30-in wiggle" style={{ fontSize: 13 }} onClick={() => setEcho(bit.a[1])}>{bit.opts[1]}</button>
                    </div></>))}
              {bit.t === 'puzzle' && (echo
                ? <button className="v30-btn v30-in" onClick={next}>далі ▸</button>
                : (<><div className="pz-opts">
                    {bit.opts.map((o) => (
                      <button key={o} className={'v30-btn v30-in' + (wrongPz === o ? ' no' : '')} style={{ fontSize: 18, minWidth: 74 }}
                        onClick={() => { o === bit.right ? setEcho(bit.win) : setWrongPz(o); }}>{o}</button>))}
                  </div>
                  {wrongPz !== null && <div className="fg-msg">{bit.lose}</div>}</>))}
              {bit.t === 'evidence' && (echo
                ? (echo === bit.win
                    ? <button className="v30-btn v30-in" onClick={next}>далі ▸</button>
                    : <button className="v30-btn v30-in" onClick={() => setEcho(null)}>ще раз ▸</button>)
                : (<div className="ev-cards">
                    {EV30.map((it) => (
                      <button key={it.id} className="ev-card v30-in" onClick={() => setEcho(it.id === bit.right ? bit.win : bit.lose)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.img} alt="" /><b>{it.nm}</b>
                      </button>))}
                  </div>))}
            </>)}
        </div>)}

      {bit.t === 'find' && !found && (
        <div className="fd-brief">
          <div className="v30-panel" style={{ minHeight: 0, fontSize: 14 }}>
            <span className="v30-name">ЯРЕМА</span>{bit.intro}
          </div>
        </div>)}
    </div>
  );
}

/* ---------- Хаб ---------- */
export default function OnbLab() {
  const [v, setV] = useState<'hub' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'stub'>('hub');
  const back = () => setV('hub');
  const done = () => setV('stub');

  return (
    <main className="ob-root"><div className="ob-stage">
      {v === 'hub' && (
        <>
          <Bg src={BG.front} />
          <div className="ob-hub">
            <h1>Онбординг · тест</h1>
            <p className="sub">Q&A як RPG-діалог. Обери механіку й проклацай до кінця.</p>
            <button className="ob-hub-btn" onClick={() => setV('n')} style={{ borderColor: '#a6e22e', boxShadow: '0 0 0 3px #a6e22e, 4px 4px 0 rgba(0,0,0,0.45)' }}>
              <span className="n" style={{ background: '#a6e22e' }}>★</span>
              <span><b>ОНБОРДИНГ 3.0</b><span>консистентні кадри + Ярема-оповідач з емоціями + піксель-UI</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('m')} style={{ borderColor: '#ff2e88', boxShadow: '0 0 0 3px #ff2e88, 4px 4px 0 rgba(0,0,0,0.45)' }}>
              <span className="n" style={{ background: '#ff2e88', color: '#fff' }}>★</span>
              <span><b>ФІНАЛ · PIXEL EDITION</b><span>все у fatpixel: find-object, timed, пазл, доказ, анімація, гра</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('j')} style={{ borderColor: '#ffc619', boxShadow: '0 0 0 3px #ffc619, 4px 4px 0 rgba(0,0,0,0.45)' }}>
              <span className="n" style={{ background: '#ffc619' }}>★</span>
              <span><b>Новела 2.0 · чаптери</b><span>ФІКСОВАНИЙ ПІДХІД: розділи, задник міняється zoom-переходом</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('l')} style={{ borderColor: '#ffc619', boxShadow: '0 0 0 3px #ffc619, 4px 4px 0 rgba(0,0,0,0.45)' }}>
              <span className="n" style={{ background: '#ffc619' }}>★</span>
              <span><b>Новела 2.1 · предмети</b><span>тапни предмет у кадрі: піксель-стиль зі STORYBOARD + інвентар</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('k')}>
              <span className="n" style={{ background: '#b7f3ee' }}>K</span>
              <span><b>Ізо-стежка</b><span>реф Monument Valley: точки в ізометрії перемикають задник</span></span>
            </button>
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
            <button className="ob-hub-btn" onClick={() => setV('g')}>
              <span className="n">G</span>
              <span><b>Мапа світу</b><span>реф Mario World: стежка вузлів, фішка їде</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('h')}>
              <span className="n">H</span>
              <span><b>Туман війни</b><span>реф Zelda/Civ: відповів — відкрив шматок двору</span></span>
            </button>
            <button className="ob-hub-btn" onClick={() => setV('i')}>
              <span className="n">I</span>
              <span><b>Настілка</b><span>реф Mario Party: хід фішкою + одноразові реакції</span></span>
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
      {v === 'g' && <WorldMap key="g" onBack={back} onDone={done} />}
      {v === 'h' && <Fog key="h" onBack={back} onDone={done} />}
      {v === 'i' && <Board key="i" onBack={back} onDone={done} />}
      {v === 'j' && <Vn2 key="j" onBack={back} onDone={done} />}
      {v === 'k' && <IsoPath key="k" onBack={back} onDone={done} />}
      {v === 'l' && <Vn3 key="l" onBack={back} onDone={done} />}
      {v === 'm' && <VnFinal key="m" onBack={back} onDone={done} />}
      {v === 'n' && <Vn30 key="n" onBack={back} onDone={done} />}
      {v === 'stub' && <Stub onBack={back} />}
    </div></main>
  );
}

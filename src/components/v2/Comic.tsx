'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { blip, pock, unlockAudio } from './dlgSound';

/**
 * Онбординг-діалог v3 (D-030..D-033) — режисура як у VN:
 * — ФОКУС кадру: 'hero' (фон у блюрі+темніший, герой великий) або
 *   'scene' (фон РІЗКИЙ — акцент на локації, герой маленький або відсутній);
 * — різні ПЛАНИ героя (sm/md/lg) і сторони (left/center/right);
 * — анімація бекграунду (повільний Кен Бернс: наїзд / панорама);
 * — кадр героя = будь-який ассет (емоції-портрети + варіації повного тіла);
 * — локація ТІЛЬКИ ДРУЇД, стіл ОДИН; тап рухає діалог, кадр міняється між тезами.
 */

type Beat = { img: string; text: string };
type Reply = { label: string; react?: Beat };
type Shot = {
  bg: string;
  focus: 'hero' | 'scene';
  anim: 'in' | 'left' | 'right';
  hero: { plan: 'sm' | 'md' | 'lg'; side: 'left' | 'center' | 'right' } | null;
  beats: Beat[];
  replies: Reply[];
};

const JOIN_URL = 'https://teniss.vercel.app/join';

const SCRIPT: Shot[] = [
  {
    bg: 'druid-alley', focus: 'scene', anim: 'in',
    hero: { plan: 'sm', side: 'right' },
    beats: [
      { img: 'vars/07', text: 'Бачиш цей парк?' },
      { img: 'vars/07', text: 'Це — ДРУЇД. Моє місце.' },
    ],
    replies: [{ label: 'А ти хто?', react: { img: 'dialog/smile', text: 'О, зараз познайомимось.' } }],
  },
  {
    bg: 'druid-alley', focus: 'hero', anim: 'left',
    hero: { plan: 'lg', side: 'left' },
    beats: [
      { img: 'dialog/talk', text: 'Я — Джеремі. Тут я живу пінг-понгом.' },
      { img: 'dialog/calm', text: 'І в нас намічається дещо серйозне.' },
    ],
    replies: [{ label: 'Розказуй!' }],
  },
  {
    bg: 'druid-day', focus: 'scene', anim: 'right',
    hero: { plan: 'sm', side: 'left' },
    beats: [
      { img: 'vars/02', text: 'Ось наш стіл. Так — один.' },
      { img: 'vars/02', text: 'І цього достатньо.' },
    ],
    replies: [{ label: 'Чому?', react: { img: 'dialog/wink', text: 'Гарне питання.' } }],
  },
  {
    bg: 'druid-day', focus: 'hero', anim: 'in',
    hero: { plan: 'md', side: 'center' },
    beats: [
      { img: 'dialog/think', text: 'Бо справа не в кількості столів…' },
      { img: 'vars/06', text: '…а в тому, ХТО за ним стоїть. Наприклад — ти.' },
    ],
    replies: [{ label: 'Я? І що робити?' }],
  },
  {
    bg: 'league', focus: 'scene', anim: 'in',
    hero: { plan: 'sm', side: 'right' },
    beats: [
      { img: 'dialog/calm', text: 'З 2 по 23 серпня — ліга. Три тижні.' },
      { img: 'dialog/talk', text: '2-го — жеребкування. У кожного — 8 матчів.' },
    ],
    replies: [{ label: 'А з ким граю?' }],
  },
  {
    bg: 'league', focus: 'hero', anim: 'right',
    hero: { plan: 'md', side: 'left' },
    beats: [
      { img: 'dialog/calm', text: 'Пари розкидає система. Телеграм суперника — у профілі.' },
      { img: 'dialog/talk', text: 'Домовились — і приходите сюди. Один стіл, один суперник, один вечір.' },
    ],
    replies: [{ label: 'А ввечері як?' }],
  },
  {
    bg: 'druid-evening', focus: 'scene', anim: 'left',
    hero: null,
    beats: [
      { img: 'dialog/smile', text: 'Ввечері над столом вмикається гірлянда.' },
      { img: 'dialog/smile', text: 'Найкращий час грати. Перевірено.' },
    ],
    replies: [{ label: 'А рахунок хто веде?' }],
  },
  {
    bg: 'honesty', focus: 'hero', anim: 'in',
    hero: { plan: 'md', side: 'right' },
    beats: [
      { img: 'dialog/strict', text: 'Ви самі. Внесли — суперник бачить.' },
      { img: 'dialog/calm', text: 'Кожен оцінює, чи грав ти на свій рівень.' },
      { img: 'vars/03', text: 'Хитруни світяться МИТТЄВО.' },
    ],
    replies: [{ label: 'Строго. Далі?', react: { img: 'dialog/smile', text: 'Ага.' } }],
  },
  {
    bg: 'rating', focus: 'hero', anim: 'left',
    hero: { plan: 'md', side: 'left' },
    beats: [
      { img: 'dialog/think', text: 'Рейтинг живе онлайн: хто з ким зіграв і хто де.' },
      { img: 'dialog/strict', text: 'Морозиш матчі — 0:0 і мінус шанси.' },
    ],
    replies: [{ label: 'А фінал?' }],
  },
  {
    bg: 'druid-dayx', focus: 'scene', anim: 'in',
    hero: { plan: 'sm', side: 'right' },
    beats: [
      { img: 'vars/01', text: '23 серпня. День Х. Тут же, на ДРУЇДІ.' },
      { img: 'vars/01', text: 'Фінали, міні-ігри, музика, люди.' },
    ],
    replies: [{ label: 'Я ж не профік…', react: { img: 'dialog/think', text: '…' } }],
  },
  {
    bg: 'druid-dayx', focus: 'hero', anim: 'right',
    hero: { plan: 'lg', side: 'center' },
    beats: [
      { img: 'vars/04', text: 'Тому і є міні-ігри!' },
      { img: 'dialog/wink', text: 'Фан-очки — нарівні зі спортивними. 50 на 50.' },
    ],
    replies: [{ label: 'А призи?' }],
  },
  {
    bg: 'prizes', focus: 'hero', anim: 'in',
    hero: { plan: 'md', side: 'left' },
    beats: [
      { img: 'dialog/smile', text: 'Два головні призи.' },
      { img: 'dialog/calm', text: 'І нагорода за заслугами — кожному, як у марафоні.' },
    ],
    replies: [{ label: 'Погнали!', react: { img: 'vars/10', text: 'Оце розмова!' } }],
  },
  {
    bg: 'druid-evening', focus: 'hero', anim: 'in',
    hero: { plan: 'lg', side: 'center' },
    beats: [
      { img: 'vars/05', text: 'Тоді реєструйся.' },
      { img: 'dialog/hype', text: 'Побачимось за столом. Я подаю перший!' },
    ],
    replies: [],
  },
];

const ALL_IMGS = [...new Set(SCRIPT.flatMap((s) => [
  ...s.beats.map((b) => b.img),
  ...s.replies.map((r) => r.react?.img).filter(Boolean) as string[],
]))];

const TYPE_MS = 26;

export default function Comic() {
  const [idx, setIdx] = useState(0);
  const [react, setReact] = useState<Beat | null>(null);
  const [beatIdx, setBeatIdx] = useState(0);
  const [chars, setChars] = useState(0);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const shot = SCRIPT[idx];
  const seq = useMemo<Beat[]>(() => (react ? [react, ...shot.beats] : shot.beats), [react, shot]);
  const beat = seq[Math.min(beatIdx, seq.length - 1)];
  const beatDone = chars >= beat.text.length;
  const lastBeat = beatIdx >= seq.length - 1;
  const shotDone = lastBeat && beatDone;
  const typed = beat.text.slice(0, chars);

  useEffect(() => {
    ALL_IMGS.forEach((src) => { const i = new Image(); i.src = `/v2/${src}.png`; });
  }, []);

  useEffect(() => {
    setChars(0);
    const text = seq[Math.min(beatIdx, seq.length - 1)].text;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setChars(text.length); return; }
    typeTimer.current = setInterval(() => {
      setChars((c) => {
        if (c >= text.length) {
          if (typeTimer.current) clearInterval(typeTimer.current);
          return c;
        }
        const ch = text[c];
        if (c % 2 === 0 && /[^\s.,!?…—:;]/.test(ch)) blip();
        return c + 1;
      });
    }, TYPE_MS);
    return () => { if (typeTimer.current) clearInterval(typeTimer.current); };
  }, [idx, beatIdx, seq]);

  function goTo(next: number, reaction: Beat | null) {
    pock();
    setReact(reaction);
    setBeatIdx(0);
    setIdx(next);
  }

  function completeOrNext() {
    unlockAudio();
    if (!beatDone) setChars(beat.text.length);
    else if (!lastBeat) setBeatIdx(beatIdx + 1);
    else if (shot.replies.length > 0 && SCRIPT[idx + 1]) goTo(idx + 1, null);
  }

  const isFinal = shot.replies.length === 0;
  // У фокусі «сцена» рефлексія/біт може мати інший кадр, але позиція героя — з шота.
  const heroSrc = beat.img;

  return (
    <div className={`v2-panel dlg focus-${shot.focus} anim-${shot.anim}`} onPointerDown={completeOrNext} key={idx}>
      <link href="https://fonts.googleapis.com/css2?family=Neucha&display=swap" rel="stylesheet" />
      {/* Шар 1: фон з Кен-Бернсом; блюр — тільки коли акцент на героєві */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="v2-bgimg" src={`/v2/bg/${shot.bg}.jpg`} alt="" />
      <div className="v2-bgfade" aria-hidden />

      <div className="v2-dots" aria-label={`Сцена ${idx + 1} з ${SCRIPT.length}`}>
        {SCRIPT.map((_, i) => (
          <i key={i} className={i === idx ? 'on' : ''} />
        ))}
      </div>

      {/* Шари 3-4: герой у потоці НАД вікном (ніколи не ховається за текстом),
          вікно — рвана рамка + Neucha */}
      <div className="v2-dlgwrap">
        {shot.hero && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className={`v2-hero plan-${shot.hero.plan} side-${shot.hero.side}`}
            src={`/v2/${heroSrc}.png`}
            alt="Джеремі"
            draggable={false}
          />
        )}
        <div className="v2-dlgbox torn">
          {/* герой праворуч → плашка їде вліво, щоб не ховатись за ним */}
          <span className={'v2-nameplate' + (shot.hero?.side === 'right' ? ' np-left' : '')}>ДЖЕРЕМІ</span>
        <p className="v2-dlgtext">
          {typed}
          {!beatDone && <span className="v2-caret" aria-hidden />}
        </p>

        {shotDone && !isFinal && (
          <div className="v2-dlgreplies">
            {shot.replies.map((r) => (
              <button
                key={r.label}
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  goTo(Math.min(idx + 1, SCRIPT.length - 1), r.react ?? null);
                }}
              >
                ▸ {r.label}
              </button>
            ))}
          </div>
        )}

        {beatDone && !(shotDone && isFinal) && <span className="v2-next" aria-hidden>▼</span>}

        {shotDone && isFinal && (
          <div className="v2-dlgreplies">
            <a href={JOIN_URL} className="v2-cta-main sm">
              Зареєструватись →
            </a>
            <button
              type="button"
              className="v2-cta-again"
              onPointerDown={(e) => {
                e.stopPropagation();
                goTo(0, null);
              }}
            >
              ↺ ще раз
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

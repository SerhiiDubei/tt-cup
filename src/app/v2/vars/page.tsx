import type { Metadata } from 'next';
import '../v2.css';
import './vars.css';

export const metadata: Metadata = {
  title: '10 варіацій Джеремі + шрифти — на затвердження',
  robots: { index: false },
};

/**
 * Стенд D-031 v2 (LAYERING + GRIDDING):
 * (А) схвалені рамки 2 і 4 з новими шрифтами;
 * (Б) 10 варіацій подачі Джеремі — кожна як сцена з шарами:
 * розмитий затемнений фон → різкий персонаж на третині → вікно поверх ніг.
 */

type V = { n: number; tag: string; bg: 'dayx' | 'league'; pos: 'left' | 'right' | 'center'; full?: boolean };

const VARS: V[] = [
  { n: 1, tag: 'Повне тіло · смеш у стрибку', bg: 'dayx', pos: 'left' },
  { n: 2, tag: 'Повне тіло · жест «дивись, що тут»', bg: 'league', pos: 'left' },
  { n: 3, tag: 'Погруддя · гіперболізований ШОК', bg: 'dayx', pos: 'center' },
  { n: 4, tag: 'Погруддя · гіперболізований ХАЙП (зірочки)', bg: 'league', pos: 'center' },
  { n: 5, tag: 'По пояс · СТІКЕР з білим обідком', bg: 'dayx', pos: 'right' },
  { n: 6, tag: 'По пояс · нахил У КАМЕРУ, вказує на глядача', bg: 'league', pos: 'right' },
  { n: 7, tag: 'ЧІБІ · велика голова, мале тіло, з ракеткою', bg: 'dayx', pos: 'left' },
  { n: 8, tag: 'Повний ріст · зі спини через плече · ракетка на плечі', bg: 'league', pos: 'left' },
  { n: 9, tag: 'Екстрим-клоузап на весь кадр · погляд-виклик', bg: 'dayx', pos: 'center', full: true },
  { n: 10, tag: 'Фістбамп У КАМЕРУ · перебільшена перспектива', bg: 'league', pos: 'center' },
];

const LINE = 'Привіт. Я — Джеремі. І в нас тут не просто пінг-понг на районі.';

export default function VarsPage() {
  return (
    <main className="vr-page">
      <link
        href="https://fonts.googleapis.com/css2?family=Neucha&family=Press+Start+2P&display=swap"
        rel="stylesheet"
      />

      <h1 className="vr-title">А · Шрифт у схвалених рамках</h1>
      <p className="vr-sub">Рамка 2 → рукописний Neucha · Рамка 4 → піксельний Press Start 2P</p>

      <div className="vr-slot">
        <span className="vr-num">2 + Neucha</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vr-bg" src="/v2/bg/dayx.jpg" alt="" />
        <div className="vr-vignette" />
        <div className="vr-box2">
          <span className="vr-name">ДЖЕРЕМІ</span>
          <p className="vr-text">{LINE}</p>
        </div>
      </div>
      <p className="vr-caption">Рукописний — теплий, живий, пасує рваній рамці.</p>

      <div className="vr-slot">
        <span className="vr-num">4 + PressStart</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vr-bg" src="/v2/bg/league.jpg" alt="" />
        <div className="vr-vignette" />
        <div className="vr-box4">
          <span className="vr-name">ДЖЕРЕМІ</span>
          <p className="vr-text">{LINE}</p>
          <span className="vr-next">▼</span>
        </div>
      </div>
      <p className="vr-caption">Піксельний — чиста ретро-гра, повільніше читається, але вайб максимальний.</p>

      <h1 className="vr-title">Б · 10 варіацій подачі Джеремі</h1>
      <p className="vr-sub">
        Кожна — сцена з шарами: розмитий фон → різкий Джеремі на третині → вікно поверх ніг.
        Відповідай номерами, які лишити.
      </p>

      {VARS.map((v) => (
        <div key={v.n}>
          <div className={`vr-slot pos-${v.pos}${v.full ? ' full' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="vr-bg" src={`/v2/bg/${v.bg}.jpg`} alt="" />
            <div className="vr-vignette" />
            <span className="vr-num">{v.n}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="vr-hero" src={`/v2/vars/${String(v.n).padStart(2, '0')}.png`} alt={v.tag} />
            <div className="vr-box2">
              <span className="vr-name">ДЖЕРЕМІ</span>
              <p className="vr-text">Привіт. Я — Джеремі.</p>
            </div>
          </div>
          <p className="vr-caption">{v.n} · {v.tag}</p>
        </div>
      ))}
    </main>
  );
}

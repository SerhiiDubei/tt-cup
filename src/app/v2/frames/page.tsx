import type { Metadata } from 'next';
import '../v2.css';
import './frames.css';

export const metadata: Metadata = {
  title: '5 рамок діалогу — на затвердження',
  robots: { index: false },
};

/**
 * Стенд D-030: пʼять варіантів рамки діалогового вікна на затвердження Сергієм.
 * Контент однаковий (Джеремі + репліка) — відрізняється тільки рамка.
 */

const LINE = 'Привіт. Я — Джеремі. І в нас тут не просто пінг-понг на районі.';

function Slot({ n, cls, caption, children }: { n: number; cls: string; caption: string; children: React.ReactNode }) {
  return (
    <>
      <div className={`fr-slot ${cls}`}>
        <span className="fr-num">{n}</span>
        <div className="fr-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="fr-face" src="/v2/dialog/talk.png" alt="Джеремі" />
          {children}
        </div>
      </div>
      <p className="fr-caption">{caption}</p>
      <div style={{ height: 34 }} />
    </>
  );
}

export default function FramesPage() {
  return (
    <main className="fr-page">
      <h1 className="fr-title">Рамка діалогу — 5 варіантів</h1>
      <p className="fr-sub">Той самий контент, різні рамки. Відповідай номером.</p>

      <Slot n={1} cls="fr1" caption="1 · Комікс-класика Memphis: крем, товстий чорний бордер, жорстка тінь, плашка-таб на рамці. Те, що зараз в онбордингу.">
        <div className="fr-box">
          <span className="fr-name">ДЖЕРЕМІ</span>
          <p className="fr-text">{LINE}</p>
        </div>
      </Slot>

      <Slot n={2} cls="fr2" caption="2 · Мальована «рвана» рамка (реф Cardpocalypse): нерівні тремтячі краї, легкий нахил, плашка-наліпка. Тепла, рукодільна.">
        <div className="fr-box">
          <span className="fr-name">ДЖЕРЕМІ</span>
          <p className="fr-text">{LINE}</p>
        </div>
      </Slot>

      <Slot n={3} cls="fr3" caption="3 · Мʼякий бабл з хвостиком до персонажа (реф Elder Owen / LINE): округлий, без бордера, тінь-повітря, TOUCH-мітка.">
        <div className="fr-box">
          <span className="fr-name">ДЖЕРЕМІ</span>
          <p className="fr-text">{LINE}</p>
          <span className="fr-touch">TOUCH</span>
        </div>
      </Slot>

      <Slot n={4} cls="fr4" caption="4 · Ретро-JRPG: темне вікно, подвійна світла рамка, моноширинний текст, ▼ — класика Pokémon/Zelda.">
        <div className="fr-box">
          <span className="fr-name">ДЖЕРЕМІ</span>
          <p className="fr-text">{LINE}</p>
          <span className="fr-next">▼</span>
        </div>
      </Slot>

      <Slot n={5} cls="fr5" caption="5 · Стріт-стікер під вайб Джеремі: чорне вікно з жовтим кантом, імʼя — рожевий стікер під нахилом.">
        <div className="fr-box">
          <span className="fr-name">ДЖЕРЕМІ</span>
          <p className="fr-text">Привіт. Я — Джеремі. І в нас тут <b>не просто пінг-понг</b> на районі.</p>
        </div>
      </Slot>
    </main>
  );
}

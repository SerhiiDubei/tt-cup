import type { Metadata } from 'next';
import '../v2.css';
import './afisha.css';

export const metadata: Metadata = {
  title: '5 афіш DRUID BATTLE CUP — на вибір',
  robots: { index: false },
};

/**
 * Стенд D-036: 5 варіацій афіші. У кожній обовʼязково: DRUID BATTLE CUP,
 * дата 23 серпня, ДРУЇД, 420 грн і QR на лендак (ttcup-onboard.vercel.app).
 * Формат 3:4 — з обраного макета зроблю друк A3 і сторіс 9:16.
 */

const QR = '/afisha/qr.png';

export default function AfishaPage() {
  return (
    <main className="af-page">
      <link href="https://fonts.googleapis.com/css2?family=Neucha&display=swap" rel="stylesheet" />
      <h1 className="af-title">Афіша — 5 варіантів</h1>
      <p className="af-sub">У кожній: назва · 23 серпня · ДРУЇД · 420 грн · QR на лендак. Відповідай номером.</p>

      {/* 1 · Вечірня гірлянда */}
      <div className="af af1">
        <span className="af-num">1</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="af-bg" src="/v2/bg/druid-evening.jpg" alt="" />
        <div className="af-shade" />
        <div className="af-top">
          <div className="af-logo">DRUID<br /><span className="y">BATTLE</span><br />CUP</div>
          <div className="af-when">23 серпня · парк ДРУЇД · Івано-Франківськ</div>
        </div>
        <div className="af-bottom">
          <div className="af-facts">
            ліга 2–23.08 · 8 матчів<br />
            фінали + міні-ігри в День Х<br />
            залік 50/50 — шанс у кожного<br />
            участь · 420 грн
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="af-qr" src={QR} alt="QR: реєстрація" />
        </div>
      </div>
      <p className="af-cap">1 · Вечірня гірлянда: фото-настрій локації, факти списком, QR у кутку.</p>

      {/* 2 · Комікс із Джеремі */}
      <div className="af af2">
        <span className="af-num">2</span>
        <div className="af-dots" />
        <div className="af-logo">DRUID <span className="p">BATTLE</span> CUP</div>
        <div className="af-bub">Один стіл. Три тижні. І твій шанс.</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="af-hero" src="/v2/vars/01.png" alt="Джеремі" />
        <div className="af-strip">
          <div>
            <b>23 серпня · ДРУЇД</b><br />
            <span>ліга 2–23.08 · 420 грн · скануй і реєструйся</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="af-qr" src={QR} alt="QR: реєстрація" />
        </div>
      </div>
      <p className="af-cap">2 · Комікс: Джеремі в смеші, жовтий Memphis, бабл з меседжем, інфо-стрічка знизу.</p>

      {/* 3 · Нічний неон */}
      <div className="af af3">
        <span className="af-num">3</span>
        <div className="af-balls" />
        <div className="af-logo">DRUID<br /><span className="full">BATTLE</span><br />CUP</div>
        <div className="af-when">23.08 · ДРУЇД · 420 грн</div>
        <div className="af-qr-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="af-qr" src={QR} alt="QR: реєстрація" />
          <div className="af-scan">скануй → грай</div>
        </div>
      </div>
      <p className="af-cap">3 · Нічний неон: чорне тло, контурна типографіка, ВЕЛИКИЙ QR — афіша-загадка.</p>

      {/* 4 · День Х */}
      <div className="af af4">
        <span className="af-num">4</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="af-bg" src="/v2/bg/druid-dayx.jpg" alt="" />
        <div className="af-shade" />
        <div className="af-date">23.08<small>неділя · День Х</small></div>
        <div className="af-bottom">
          <div>
            <div className="af-logo">DRUID BATTLE CUP</div>
            <div className="af-note">парк ДРУЇД · ліга з 2.08 · 420 грн</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="af-qr" src={QR} alt="QR: реєстрація" />
        </div>
      </div>
      <p className="af-cap">4 · День Х: величезна дата як герой афіші, святковий фон локації.</p>

      {/* 5 · Типографіка Memphis */}
      <div className="af af5">
        <span className="af-num">5</span>
        <div className="af-frame" />
        <div className="af-ball" />
        <div className="af-logo"><span className="o1">DRUID</span><br /><span className="p">BATTLE</span><br />CUP</div>
        <div className="af-list">
          <i>■</i> ліга 2–23 серпня<br />
          <i>■</i> 8 матчів · один стіл · ДРУЇД<br />
          <i>■</i> фінали + міні-ігри<br />
          <i>■</i> залік 50/50 — шанс у кожного
        </div>
        <div className="af-bottom">
          <div className="af-when">23 СЕРПНЯ<small>420 грн · реєстрація до 2.08</small></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="af-qr" src={QR} alt="QR: реєстрація" />
        </div>
      </div>
      <p className="af-cap">5 · Типографіка Memphis: крем, чиста верстка, факти — плакат «для дошки оголошень».</p>
    </main>
  );
}

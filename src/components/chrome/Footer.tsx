import { BRAND } from '@/config';

/** Футер сервісу (D-044): лінки ліги, без мертвих якорів старого кубка (аудит R-012). */
export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="big">ГРАЙ.<br /><span style={{ color: 'var(--pink)' }}>ВПИСУЙ.</span> ПЕРЕМАГАЙ.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, marginTop: 40 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>{BRAND}</div>
            <p style={{ opacity: 0.7, marginTop: 8, maxWidth: 320, fontSize: 14 }}>
              Ліга 7–12 вересня на ДРУЇДІ · 8 матчів · залік 50/50 · День Х — 13 вересня.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="/standings">Сітка</a>
            <a href="/players">Гравці</a>
            <a href="/yak">Як усе влаштовано</a>
            <a href="/join">Реєстрація</a>
          </div>
          {/* Документи мерчанта — вимога платіжної системи до сайту */}
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="/oferta">Публічний договір</a>
            <a href="/refund">Повернення коштів</a>
            <a href="/contacts">Контакти і реквізити</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,242,227,.2)', marginTop: 36, paddingTop: 20, display: 'flex', flexWrap: 'wrap', gap: '10px 22px', alignItems: 'center', fontSize: 13, opacity: 0.7 }}>
          <span>© 2026 {BRAND}</span>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><b style={{ letterSpacing: '.06em' }}>VISA</b><span aria-hidden>·</span><b style={{ letterSpacing: '.06em' }}>Mastercard</b></span>
          <a href="https://www.wayforpay.com" target="_blank" rel="noopener">Оплата карткою через WayForPay</a>
          <span>ФОП Дубей С. В. · ІПН 3327100410</span>
        </div>
      </div>
    </footer>
  );
}

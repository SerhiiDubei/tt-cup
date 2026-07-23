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
              Ліга 2–23 серпня на ДРУЇДІ · 8 матчів · залік 50/50 · День Х — 23 серпня.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="/standings">Сітка</a>
            <a href="/schedule">Розклад</a>
            <a href="/players">Гравці</a>
            <a href="/pravyla">Правила</a>
            <a href="/join">Реєстрація</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,242,227,.2)', marginTop: 36, paddingTop: 20, fontSize: 13, opacity: 0.6 }}>
          © 2026 {BRAND}. Зроблено з 🏓
        </div>
      </div>
    </footer>
  );
}

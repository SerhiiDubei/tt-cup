import { BRAND } from '@/config';

export default function Footer() {
  return (
    <footer className="site">
      <div className="wrap">
        <div className="big">ГРАЙ.<br /><span style={{ color: 'var(--pink)' }}>ВПИСУЙ.</span> ПЕРЕМАГАЙ.</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, marginTop: 40 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>{BRAND}</div>
            <p style={{ opacity: 0.7, marginTop: 8, maxWidth: 320, fontSize: 14 }}>
              Турнір з настільного тенісу · швейцарка 8 турів · топ-8 офлайн плей-офф.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="/players">Учасники</a>
            <a href="/standings">Таблиця</a>
            <a href="/bracket">Плей-офф</a>
            <a href="#builder">Реєстрація</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,242,227,.2)', marginTop: 36, paddingTop: 20, fontSize: 13, opacity: 0.6 }}>
          © 2026 {BRAND}. Зроблено з 🏓
        </div>
      </div>
    </footer>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { BRAND } from '@/config';

export default function Nav() {
  const [status, setStatus] = useState('registration');
  const [me, setMe] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMe(localStorage.getItem('tt_token'));
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    fetch('/api/state').then((r) => r.json()).then((d) => setStatus(d.tournament?.status || 'registration')).catch(() => {});
  }, []);

  const links: [string, string][] = [['/', 'Головна'], ['/how', 'Як грати'], ['/players', 'Учасники'], ['/cup', '🏆 Кубок'], ['/table', 'Стіл']];
  if (status !== 'registration') links.push(['/schedule', 'Розклад'], ['/standings', 'Таблиця']);
  if (status === 'playoff' || status === 'done') links.push(['/bracket', 'Плей-офф']);
  if (me) links.push(['/me/' + me, 'Я']);

  function toggleDark() {
    const el = document.documentElement;
    const next = el.getAttribute('data-theme') === 'dark' ? '' : 'dark';
    el.setAttribute('data-theme', next);
    localStorage.setItem('tt_theme', next);
    setDark(next === 'dark');
  }

  return (
    <header>
      <a href="/" className="logo"><span className="eye" />{BRAND}</a>
      <nav className={'nav-links' + (open ? ' open' : '')}>
        {links.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>
      <div className="nav-tools">
        <button className="icon-btn" aria-label="Тема" onClick={toggleDark}>{dark ? '☀' : '☾'}</button>
        <button className="icon-btn burger" aria-label="Меню" onClick={() => setOpen((o) => !o)}>☰</button>
      </div>
    </header>
  );
}

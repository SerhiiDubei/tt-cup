'use client';
import { useState } from 'react';
import { PALETTE, SHAPES, STYLES } from '@/config';
import HeroCard from '@/components/HeroCard';
import { register } from '@/lib/api';

const EMBLEMS = ['★', '◆', '✦', '▲', '●', '✺', '♦', '✪'];
const SHAPE_LABEL: Record<string, string> = { circle: 'Коло', square: 'Квадрат', triangle: 'Трикутник', diamond: 'Ромб' };
const STYLE_LABEL: Record<string, string> = { attacker: 'Атакер', defender: 'Захисник', allrounder: 'Універсал', spinner: 'Спінер' };
const ERR: Record<string, string> = {
  nick_taken: 'Такий нік уже зайнятий', registration_closed: 'Реєстрацію закрито',
  deadline_passed: 'Дедлайн реєстрації минув', name_required: 'Введи імʼя',
};

export default function HeroBuilder() {
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [motto, setMotto] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [shape, setShape] = useState<string>('circle');
  const [style, setStyle] = useState<string>('attacker');
  const [emblem, setEmblem] = useState('★');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const hero = { color, shape, style, emblem };

  async function submit() {
    if (!name.trim()) { setMsg({ t: ERR.name_required, ok: false }); return; }
    setBusy(true); setMsg(null);
    try {
      const { token } = await register({ name: name.trim(), nickname: (nick || name).trim(), hero, motto: motto.trim() });
      localStorage.setItem('tt_token', token);
      setMsg({ t: 'Готово! Перенаправляю на твою картку…', ok: true });
      setTimeout(() => { location.href = '/me/' + token; }, 600);
    } catch (e) {
      const m = (e as Error).message;
      setMsg({ t: ERR[m] || 'Помилка: ' + m, ok: false });
    } finally { setBusy(false); }
  }

  return (
    <section id="builder">
      <div className="wrap">
        <span className="eyebrow reveal">конструктор героя</span>
        <h2 className="title reveal">Збери свого <span className="swirl">гравця</span></h2>
        <p className="lead reveal d1" style={{ marginBottom: 30 }}>Налаштуй картку — і одним кліком зареєструйся в турнірі.</p>

        <div className="build-grid">
          <div className="card reveal d1">
            <div className="opt-row">
              <span className="lbl">Колір ракетки</span>
              <div className="swatches">
                {PALETTE.map((c) => (
                  <button key={c} className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                ))}
              </div>
            </div>
            <div className="opt-row">
              <span className="lbl">Форма емблеми</span>
              <div className="pickrow">
                {SHAPES.map((s) => <button key={s} className={'pick' + (s === shape ? ' on' : '')} onClick={() => setShape(s)}>{SHAPE_LABEL[s]}</button>)}
              </div>
            </div>
            <div className="opt-row">
              <span className="lbl">Стиль гри</span>
              <div className="pickrow">
                {STYLES.map((s) => <button key={s} className={'pick' + (s === style ? ' on' : '')} onClick={() => setStyle(s)}>{STYLE_LABEL[s]}</button>)}
              </div>
            </div>
            <div className="opt-row">
              <span className="lbl">Емблема</span>
              <div className="pickrow">
                {EMBLEMS.map((e) => <button key={e} className={'pick' + (e === emblem ? ' on' : '')} style={{ fontSize: 18 }} onClick={() => setEmblem(e)}>{e}</button>)}
              </div>
            </div>
            <div className="field"><label>Імʼя</label><input className="input" maxLength={24} placeholder="Олег Ракетка" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Нік (латиницею)</label><input className="input" maxLength={16} placeholder="TOPSPIN_OLEG" value={nick} onChange={(e) => setNick(e.target.value.replace(/\s+/g, '_'))} /></div>
            <div className="field"><label>Девіз</label><input className="input" maxLength={40} placeholder="ракетка — продовження руки" value={motto} onChange={(e) => setMotto(e.target.value)} /></div>
            <button className="btn pink" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={submit}>
              {busy ? 'Реєструю…' : '✚ Грати цим героєм'}
            </button>
            {msg && <p style={{ marginTop: 14, fontWeight: 700, color: msg.ok ? 'var(--ink)' : 'var(--coral)' }}>{msg.t}</p>}
          </div>

          <div className="reveal d2" style={{ position: 'sticky', top: 100 }}>
            <div className="tilt-r"><HeroCard name={name} nickname={nick || name} motto={motto} hero={hero} /></div>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>↑ так виглядатиме твоя картка</p>
          </div>
        </div>
      </div>
    </section>
  );
}

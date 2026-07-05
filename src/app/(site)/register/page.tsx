'use client';
import { useState } from 'react';
import { AVATAR_OPTIONS, DEFAULT_TRAITS, SUPERPOWER_LABEL, type Traits } from '@/lib/avatar';
import { STYLES } from '@/config';
import HeroCard from '@/components/HeroCard';
import ArtifactReveal from '@/components/ArtifactReveal';
import SelfieCapture from '@/components/SelfieCapture';
import { genAvatar, stylizeSelfie, register } from '@/lib/api';

const STYLE_LABEL: Record<string, string> = { attacker: 'Атакер', defender: 'Захисник', allrounder: 'Універсал', spinner: 'Спінер' };
const GROUP_TITLE: Record<keyof Traits, string> = {
  gender: 'Стать', skin: 'Шкіра', hair: 'Зачіска', hairColor: 'Колір волосся', outfit: 'Форма', accessory: 'Аксесуар',
};

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [t, setT] = useState<Traits>(DEFAULT_TRAITS);
  const [style, setStyle] = useState<string>('attacker');
  const [art, setArt] = useState('');
  const [gen, setGen] = useState(false);
  const [name, setName] = useState('');
  const [nick, setNick] = useState('');
  const [motto, setMotto] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [reveal, setReveal] = useState(false);
  const [mode, setMode] = useState<'selfie' | 'traits'>('selfie');
  const [selfie, setSelfie] = useState<string | null>(null);

  const outfitSwatch = AVATAR_OPTIONS.outfit.find((o) => o.id === t.outfit)?.swatch || '#FF2E88';
  const color = outfitSwatch === '#FFFFFF' ? '#FF2E88' : outfitSwatch;
  const hero = { ...t, color, shape: 'circle', style, emblem: '★', art };

  function setTrait(k: keyof Traits, v: string) { setT((p) => ({ ...p, [k]: v })); setArt(''); }

  async function generate() {
    setGen(true); setMsg(null);
    try { const { url } = await genAvatar(t); setArt(url); setReveal(true); }
    catch (e) { setMsg({ t: 'Не вдалось намалювати: ' + (e as Error).message, ok: false }); }
    finally { setGen(false); }
  }
  async function stylize() {
    if (!selfie) return;
    setGen(true); setMsg(null);
    try { const { url } = await stylizeSelfie(selfie, style); setArt(url); setReveal(true); }
    catch (e) {
      const m = (e as Error).message;
      const map: Record<string, string> = { selfie_too_large: 'Фото завелике — перезніми', no_image: 'AI не впорався, спробуй ще раз', bad_selfie: 'Невірний кадр', no_openrouter_key: 'Сервер без AI-ключа' };
      setMsg({ t: map[m] || 'Не вдалось стилізувати: ' + m, ok: false });
    } finally { setGen(false); }
  }
  async function submit() {
    if (!name.trim()) { setMsg({ t: 'Введи імʼя', ok: false }); return; }
    setBusy(true); setMsg(null);
    try {
      const { token } = await register({ name: name.trim(), nickname: (nick || name).trim(), hero, motto: motto.trim() });
      localStorage.setItem('tt_token', token);
      location.href = '/me/' + token;
    } catch (e) {
      const m = (e as Error).message;
      const map: Record<string, string> = { nick_taken: 'Такий нік уже зайнятий', registration_closed: 'Реєстрацію закрито', deadline_passed: 'Дедлайн реєстрації минув' };
      setMsg({ t: map[m] || 'Помилка: ' + m, ok: false }); setBusy(false);
    }
  }

  const Group = ({ group }: { group: keyof Traits }) => {
    const opts = AVATAR_OPTIONS[group];
    const swatchMode = opts.every((o) => o.swatch);
    return (
      <div className="opt-row">
        <span className="lbl">{GROUP_TITLE[group]}</span>
        <div className={swatchMode ? 'swatches' : 'pickrow'}>
          {opts.map((o) => swatchMode
            ? <button key={o.id} className={'swatch' + (t[group] === o.id ? ' on' : '')} style={{ background: o.swatch }} title={o.label} aria-label={o.label} onClick={() => setTrait(group, o.id)} />
            : <button key={o.id} className={'pick' + (t[group] === o.id ? ' on' : '')} onClick={() => setTrait(group, o.id)}>{o.label}</button>)}
        </div>
      </div>
    );
  };

  const preview = (
    <div className="reveal in" style={{ position: 'sticky', top: 100, justifySelf: 'center' }}>
      <div className="tilt-r"><HeroCard name={name || 'ТВІЙ ГЕРОЙ'} nickname={nick || 'nickname'} motto={motto} hero={hero} /></div>
      {!art && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)', marginTop: 12, maxWidth: 300 }}>↑ натисни «Намалювати героя», щоб AI створив портрет за твоїми рисами</p>}
    </div>
  );

  return (
    <main>
      <section>
        <div className="wrap">
          <span className="eyebrow reveal in">реєстрація · крок {step}/2</span>
          <h2 className="title reveal in">{step === 1 ? <>Збери свого <span className="swirl">героя</span></> : <>Як тебе <span className="swirl">звати?</span></>}</h2>

          {step === 1 && (
            <>
              <div className="fx-tabs reveal in" style={{ marginBottom: 18 }}>
                <button className={'fx-tab' + (mode === 'selfie' ? ' on' : '')} onClick={() => { setMode('selfie'); setArt(''); }}>📸 Селфі-герой</button>
                <button className={'fx-tab' + (mode === 'traits' ? ' on' : '')} onClick={() => { setMode('traits'); setArt(''); setSelfie(null); }}>🎨 Зібрати риси</button>
              </div>
              <div className="build-grid">
                <div className="card reveal in">
                  <div className="opt-row">
                    <span className="lbl">Стиль гри → суперсила</span>
                    <div className="pickrow">
                      {STYLES.map((s) => <button key={s} className={'pick' + (s === style ? ' on' : '')} onClick={() => { setStyle(s); setArt(''); }}>{STYLE_LABEL[s]} {SUPERPOWER_LABEL[s]}</button>)}
                    </div>
                  </div>

                  {mode === 'selfie' ? (
                    <>
                      <SelfieCapture onCaptured={(d) => { setSelfie(d); setArt(''); }} onUnavailable={() => {}} />
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                        <button className="btn cyan" onClick={stylize} disabled={gen || !selfie}>{gen ? '✨ Малюю героя… (~15с)' : art ? '↻ Стилізувати ще раз' : '✨ Стилізувати героя'}</button>
                        <button className="btn pink" onClick={() => setStep(2)} disabled={!art}>Далі →</button>
                      </div>
                      <p style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-soft)' }}>🔒 Фото йде на сервер лише для AI-стилізації. Обличчя лишається твоїм + суперсила за стилем.</p>
                    </>
                  ) : (
                    <>
                      <Group group="gender" />
                      <Group group="skin" />
                      <Group group="hair" />
                      <Group group="hairColor" />
                      <Group group="outfit" />
                      <Group group="accessory" />
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                        <button className="btn cyan" onClick={generate} disabled={gen}>{gen ? '🎨 Малюю героя… (~15с)' : art ? '↻ Намалювати ще раз' : '🎨 Намалювати героя'}</button>
                        <button className="btn pink" onClick={() => setStep(2)} disabled={!art}>Далі →</button>
                      </div>
                    </>
                  )}
                  {msg && <p style={{ marginTop: 12, fontWeight: 700, color: msg.ok ? 'var(--ink)' : 'var(--coral)' }}>{msg.t}</p>}
                </div>
                {preview}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="build-grid">
              <div className="card reveal in">
                <div className="field"><label>Імʼя</label><input className="input" maxLength={24} placeholder="Олег Ракетка" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="field"><label>Нік (латиницею)</label><input className="input" maxLength={16} placeholder="TOPSPIN_OLEG" value={nick} onChange={(e) => setNick(e.target.value.replace(/\s+/g, '_'))} /></div>
                <div className="field"><label>Девіз</label><input className="input" maxLength={40} placeholder="ракетка — продовження руки" value={motto} onChange={(e) => setMotto(e.target.value)} /></div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                  <button className="btn ghost" onClick={() => setStep(1)}>← Назад</button>
                  <button className="btn pink" style={{ flex: 1, justifyContent: 'center' }} onClick={submit} disabled={busy}>{busy ? 'Реєструю…' : '✚ Зареєструватися'}</button>
                </div>
                {msg && <p style={{ marginTop: 12, fontWeight: 700, color: msg.ok ? 'var(--ink)' : 'var(--coral)' }}>{msg.t}</p>}
              </div>
              {preview}
            </div>
          )}
        </div>
      </section>
      {reveal && <ArtifactReveal hero={hero} name={name} nickname={nick} motto={motto} onClose={() => setReveal(false)} />}
    </main>
  );
}

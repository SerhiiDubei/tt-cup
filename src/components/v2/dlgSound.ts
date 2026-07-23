// Звук ігрового діалогу (Undertale-стайл): бліп на символи тайпрайтера,
// «пок» на перехід панелі. Синтез Web Audio — жодних файлів.
// Контекст створюється лише після першого жесту користувача (мобільна політика).

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Викликати з першого pointerdown — розблоковує аудіо на мобільних. */
export function unlockAudio() { ac(); }

/** Короткий бліп під символ тексту; пітч трохи гуляє, щоб не було кулемета. */
export function blip() {
  const c = ac();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 470 + Math.random() * 140;
  g.gain.setValueAtTime(0.028, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.05);
}

/** Мʼякий «пок» — перехід до наступної репліки/панелі. */
export function pock() {
  const c = ac();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(130, t + 0.09);
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.12);
}

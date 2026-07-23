'use client';

/**
 * Звуковий шар без жодного аудіофайлу: удар мʼяча («пляць») синтезується
 * Web Audio. Вимкнено за замовчуванням — вмикається кнопкою (жест юзера
 * заразом розблоковує AudioContext).
 */

let ctx: AudioContext | null = null;
let on = false;

export function soundEnabled() {
  return on;
}

export function toggleSound(): boolean {
  on = !on;
  if (on && !ctx) {
    type W = Window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? (window as W).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (on) void ctx?.resume();
  return on;
}

/** Удар мʼяча об стіл: короткий тональний «пок» з падінням висоти. */
export function pock(intensity = 1) {
  if (!on || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(760 + Math.random() * 120, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
  gain.gain.setValueAtTime(0.28 * intensity, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.14);
}

/** Фанфара фіналу: три швидкі ноти. */
export function tada() {
  if (!on || !ctx) return;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    if (!ctx) return;
    const t = ctx.currentTime + i * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

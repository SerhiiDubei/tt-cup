import type { CupState } from '@/lib/cup/types';

export const STORAGE_KEY = 'tt_cup_v1';

/** SSR-safe read of the persisted cup. Returns null on server, missing, or parse error. */
export function loadCup(): CupState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CupState;
  } catch {
    return null;
  }
}

/** SSR-safe write of the cup state. No-op on server. */
export function saveCup(state: CupState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / serialization errors
  }
}

/** SSR-safe removal of the persisted cup. No-op on server. */
export function clearCup(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

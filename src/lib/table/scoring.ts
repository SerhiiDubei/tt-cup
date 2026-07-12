import type { SetScore } from '@/lib/tournament/types';

const MAX_POINTS = 99;

export type SetsError = 'no_sets' | 'bad_points' | 'set_tied' | 'bad_set_score' | 'match_tied';

/**
 * Легальний рахунок сету для цілі t: переможець рівно t (суперник ≤ t-2)
 * або дюс — понад t з різницею рівно 2 (12:10, 15:13, 22:20…).
 */
const legalFor = (t: number, w: number, l: number) =>
  (w === t && l <= t - 2) || (w > t && w - l === 2);

/** Сет коректний для пінг-понгу: до 11 або до 21 (обидва формати клубу). */
export function isLegalSet([x, y]: SetScore): boolean {
  const w = Math.max(x, y), l = Math.min(x, y);
  return legalFor(11, w, l) || legalFor(21, w, l);
}

/** null = ok, інакше snake_code помилки (той самий код летить у API 4xx). */
export function validateSets(sets: SetScore[]): SetsError | null {
  if (!Array.isArray(sets) || sets.length === 0) return 'no_sets';
  for (const s of sets) {
    if (!Array.isArray(s) || s.length !== 2) return 'bad_points';
    const [x, y] = s;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return 'bad_points';
    if (x < 0 || y < 0 || x > MAX_POINTS || y > MAX_POINTS) return 'bad_points';
    if (x === y) return 'set_tied';
    // фідбек клубу: «можна наклацати 27:34» — рахунок має бути реальним
    if (!isLegalSet(s)) return 'bad_set_score';
  }
  const aw = sets.filter(([x, y]) => x > y).length;
  if (aw * 2 === sets.length) return 'match_tied'; // порівну виграних сетів
  return null;
}

/** Переможець матчу за більшістю виграних сетів. Викликати ПІСЛЯ validateSets. */
export function casualWinner(a: string, b: string, sets: SetScore[]): string {
  const aw = sets.filter(([x, y]) => x > y).length;
  return aw > sets.length - aw ? a : b;
}

/* ---------- швидкий фініш «ХТО ПЕРЕМІГ?» (один сет до 11 або до 21) ---------- */

export const QUICK_TARGETS = [11, 21] as const;
export type QuickTarget = (typeof QUICK_TARGETS)[number];

/** Дефолт очок переможеного: 9 при грі до 11, 19 — до 21 (типовий рахунок). */
export const quickDefaultLoser = (target: QuickTarget): number => target - 2;

/** Очки переможця для рахунку переможеного: до target-2 — рівно target; далі — дюс (l+2). */
export const quickWinnerPts = (target: number, loserPts: number): number =>
  loserPts <= target - 2 ? target : loserPts + 2;

/**
 * Один сет швидкого фінішу, орієнтований a:b — той самий контракт, що й у
 * повній формі (finishGame очікує сети в порядку гравців гри). Один степпер
 * покриває і дюси: l=9→11:9, l=10→12:10, l=15→17:15. Валідний за побудовою.
 */
export function quickSets(winnerIsA: boolean, target: number, loserPts: number): SetScore[] {
  const w = quickWinnerPts(target, loserPts);
  return winnerIsA ? [[w, loserPts]] : [[loserPts, w]];
}

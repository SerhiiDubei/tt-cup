import type { CasualGame, Title } from './types';

/**
 * Статистика «шоу-пакета» топу (спека, Addendum 2). Все — чисті функції над
 * done-іграми: рейтинг у будь-який момент реконструюється з дельт (ігри до
 * запуску рейтингу мають delta NULL і на криву не впливають).
 */

const doneAsc = (games: CasualGame[]) =>
  games
    .filter((g) => g.status === 'done' && g.winner && g.ended_at)
    .sort((a, b) => a.ended_at!.localeCompare(b.ended_at!));

/** Рейтинги на момент `atTs` (ISO). Гравці без рейтингових ігор → 1000. */
export function ratingsAt(games: CasualGame[], atTs: string): Map<string, number> {
  const r = new Map<string, number>();
  for (const g of doneAsc(games)) {
    if (g.ended_at! > atTs) break;
    if (g.delta_a == null || g.delta_b == null) continue;
    r.set(g.a, (r.get(g.a) ?? 1000) + g.delta_a);
    r.set(g.b, (r.get(g.b) ?? 1000) + g.delta_b);
  }
  return r;
}

/** Позиції в топі на момент atTs (1-based). Той самий сорт, що в лідерборді. */
export function positionsAt(games: CasualGame[], atTs: string): Map<string, number> {
  const ratings = ratingsAt(games, atTs);
  const wl = new Map<string, { w: number; l: number }>();
  for (const g of doneAsc(games)) {
    if (g.ended_at! > atTs) break;
    const loser = g.winner === g.a ? g.b : g.a;
    wl.set(g.winner!, { w: (wl.get(g.winner!)?.w ?? 0) + 1, l: wl.get(g.winner!)?.l ?? 0 });
    wl.set(loser, { w: wl.get(loser)?.w ?? 0, l: (wl.get(loser)?.l ?? 0) + 1 });
  }
  const rows = [...wl.entries()].map(([id, s]) => ({ id, rating: ratings.get(id) ?? 1000, ...s }));
  rows.sort((x, y) => y.rating - x.rating || y.w - x.w || x.l - y.l);
  return new Map(rows.map((r, i) => [r.id, i + 1]));
}

/**
 * Рух у топі: позиція 24 год тому мінус позиція зараз (+2 = піднявся на 2).
 * null — гравця ще не було в топі добу тому.
 */
export function rankMoves(games: CasualGame[], nowTs: string): Map<string, number | null> {
  const dayAgo = new Date(Date.parse(nowTs) - 24 * 3600 * 1000).toISOString();
  const before = positionsAt(games, dayAgo);
  const now = positionsAt(games, nowTs);
  const out = new Map<string, number | null>();
  for (const [id, pos] of now) {
    const prev = before.get(id);
    out.set(id, prev == null ? null : prev - pos);
  }
  return out;
}

/** Форма: останні n ігор гравця, найновіша ПЕРША: 'W' | 'L'. */
export function formOf(games: CasualGame[], playerId: string, n = 5): ('W' | 'L')[] {
  const mine = doneAsc(games).filter((g) => g.a === playerId || g.b === playerId);
  return mine.slice(-n).reverse().map((g) => (g.winner === playerId ? 'W' : 'L'));
}

/** Початок поточного тижня (понеділок 00:00) у Europe/Kyiv, ISO. */
export function kyivWeekStart(nowTs: string): string {
  const now = new Date(nowTs);
  // «зараз» у Києві: зсув між локальним поданням TZ і UTC
  const kyiv = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }));
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = kyiv.getTime() - utc.getTime();
  const local = new Date(now.getTime() + offsetMs);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = понеділок
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
  return new Date(monday - offsetMs).toISOString();
}

export type WeeklyRow = { id: string; gained: number; wins: number; losses: number };

/** Тижнева гонка: сума дельт + W-L у вікні [sinceTs, ∞). Сорт: набране ↓, перемоги ↓. */
export function weeklyRows(games: CasualGame[], sinceTs: string): WeeklyRow[] {
  const rows = new Map<string, WeeklyRow>();
  const row = (id: string) => {
    if (!rows.has(id)) rows.set(id, { id, gained: 0, wins: 0, losses: 0 });
    return rows.get(id)!;
  };
  for (const g of doneAsc(games)) {
    if (g.ended_at! < sinceTs) continue;
    const loser = g.winner === g.a ? g.b : g.a;
    row(g.winner!).wins++;
    row(loser).losses++;
    if (g.delta_a != null && g.delta_b != null) {
      row(g.a).gained += g.delta_a;
      row(g.b).gained += g.delta_b;
    }
  }
  return [...rows.values()].sort((x, y) => y.gained - x.gained || y.wins - x.wins || x.losses - y.losses);
}

const MARATHON_MIN_GAMES = 3;
const LIGHTNING_MIN_MS = 60_000; // <1 хв — артефакт вводу, не рекорд

/**
 * Титули:
 * giant — переміг суперника з рейтингом на ≥100 вище (на момент тієї гри), назавжди;
 * comeback — виграв матч після 0:2 по сетах, назавжди;
 * marathon — найбільше ігор за останні 7 діб (≥3, може бути кілька при нічиїй);
 * lightning — найшвидша перемога останніх 7 діб (тривалість ≥1 хв, один володар).
 */
export function titlesOf(games: CasualGame[], nowTs: string): Map<string, Title[]> {
  const out = new Map<string, Set<Title>>();
  const add = (id: string, t: Title) => {
    if (!out.has(id)) out.set(id, new Set());
    out.get(id)!.add(t);
  };

  // giant + comeback — реплеєм історії, з рейтингами ДО кожної гри
  const live = new Map<string, number>();
  for (const g of doneAsc(games)) {
    const loser = g.winner === g.a ? g.b : g.a;
    if (g.delta_a != null && g.delta_b != null) {
      const rw = live.get(g.winner!) ?? 1000;
      const rl = live.get(loser) ?? 1000;
      if (rl - rw >= 100) add(g.winner!, 'giant');
      live.set(g.a, (live.get(g.a) ?? 1000) + g.delta_a);
      live.set(g.b, (live.get(g.b) ?? 1000) + g.delta_b);
    }
    const winnerIsA = g.winner === g.a;
    const lostFirstTwo =
      g.sets.length >= 3 &&
      (winnerIsA ? g.sets[0][0] < g.sets[0][1] && g.sets[1][0] < g.sets[1][1]
                 : g.sets[0][0] > g.sets[0][1] && g.sets[1][0] > g.sets[1][1]);
    if (lostFirstTwo) add(g.winner!, 'comeback');
  }

  // marathon + lightning — вікно 7 діб від nowTs
  const since = new Date(Date.parse(nowTs) - 7 * 24 * 3600 * 1000).toISOString();
  const week = doneAsc(games).filter((g) => g.ended_at! >= since);
  const counts = new Map<string, number>();
  for (const g of week) {
    counts.set(g.a, (counts.get(g.a) ?? 0) + 1);
    counts.set(g.b, (counts.get(g.b) ?? 0) + 1);
  }
  const max = Math.max(0, ...counts.values());
  if (max >= MARATHON_MIN_GAMES)
    for (const [id, c] of counts) if (c === max) add(id, 'marathon');

  let fastest: { id: string; ms: number } | null = null;
  for (const g of week) {
    const ms = Date.parse(g.ended_at!) - Date.parse(g.started_at);
    if (ms >= LIGHTNING_MIN_MS && (fastest == null || ms < fastest.ms))
      fastest = { id: g.winner!, ms };
  }
  if (fastest) add(fastest.id, 'lightning');

  return new Map([...out.entries()].map(([id, s]) => [id, [...s]]));
}

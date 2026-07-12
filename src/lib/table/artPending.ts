/**
 * Клієнтський трекер «арт героя ще малюється»: квик-адд позначає id одразу
 * після створення гравця з селфі, а картки/ряди показують міні-лоадер
 * пінг-понг, доки полінг не принесе hero.art. TTL страхує від зависання
 * (невдала генерація без catch, перезапуск бекенда тощо).
 * Стан модульний і суто клієнтський — кіоск живе однією вкладкою.
 */
const TTL_MS = 5 * 60_000;

const pending = new Map<string, number>();

export function markArtPending(id: string): void {
  pending.set(id, Date.now());
}

export function clearArtPending(id: string): void {
  pending.delete(id);
}

export function isArtPending(id: string): boolean {
  const t = pending.get(id);
  if (t == null) return false;
  if (Date.now() - t > TTL_MS) {
    pending.delete(id);
    return false;
  }
  return true;
}

// Клієнтський кеш профілю/кабінету (D-049): stale-while-revalidate.
// Перший рендер — миттєво з localStorage, мережа оновлює тихо у фоні.
// «Завантажую…» людина бачить лише при найпершому візиті.

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null; // SSR: localStorage нема
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return (JSON.parse(raw) as { d: T }).d;
  } catch { return null; }
}

export function writeCache(key: string, d: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify({ d, ts: Date.now() })); } catch { /* ок */ }
}

export function clearLigaCaches() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('dbc_cache_')) localStorage.removeItem(k);
    }
  } catch { /* ок */ }
}

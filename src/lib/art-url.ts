export const ART_MAX = 300;
const STORAGE_PREFIX = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/storage/v1/object/public/tt-avatars/';

/** art приймається ТІЛЬКИ як публічний URL нашого бакета tt-avatars (спека §6). */
export function isValidArtUrl(art: unknown): art is string {
  // без env префікс стає відносним і матчить будь-що — тоді нічого не приймаємо
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  return typeof art === 'string' && art.startsWith(STORAGE_PREFIX()) && art.length <= ART_MAX;
}

/**
 * Правило старту гри (спека §3/§6): якщо черга непорожня, кожен з гравців має
 * бути в черзі АБО бути переможцем останньої done-гри («переможець лишається»).
 * null = можна, інакше snake_code для API.
 */
export type StartError = 'same_player' | 'not_in_queue';

export function startError(
  a: string, b: string, queueIds: string[], lastWinner: string | null
): StartError | null {
  if (a === b) return 'same_player';
  if (queueIds.length === 0) return null;
  const ok = (p: string) => queueIds.includes(p) || p === lastWinner;
  return ok(a) && ok(b) ? null : 'not_in_queue';
}

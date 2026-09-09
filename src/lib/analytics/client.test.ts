import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Кабінет — сторінка, з якої люди платять. Тест стереже одне: що б не
 * сталося з аналітикою, вона не має кинути виняток у бік сторінки.
 * Плюс перевіряє місток identify, без якого клієнтські й серверні події
 * лишаються двома різними списками людей.
 */

const h = vi.hoisted(() => {
  // Хелпер свідомо мовчить без window (щоб не впасти під час SSR), тому
  // для тесту підставляємо мінімальну заглушку браузера.
  const g = globalThis as { window?: unknown };
  g.window = g.window ?? {};
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
  return {
    init: [] as unknown[][],
    captured: [] as unknown[][],
    identified: [] as unknown[][],
    registered: [] as unknown[][],
    breakInit: { on: false },
    breakCapture: { on: false },
  };
});

vi.mock('posthog-js', () => ({
  default: {
    init: (...a: unknown[]) => { if (h.breakInit.on) throw new Error('boom'); h.init.push(a); },
    capture: (...a: unknown[]) => { if (h.breakCapture.on) throw new Error('boom'); h.captured.push(a); },
    identify: (...a: unknown[]) => { h.identified.push(a); },
    register: (...a: unknown[]) => { h.registered.push(a); },
  },
}));

const { track, identifyPlayer, playerId } = await import('./client');

/** Виклики свідомо не чекають на себе — даємо мікрозадачам добігти. */
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  h.captured.length = 0; h.identified.length = 0;
  h.breakInit.on = false; h.breakCapture.on = false;
});

describe('місток до серверних подій', () => {
  it('id збігається з тим, який шле колбек оплати', () => {
    expect(playerId(47)).toBe('dbc-player-47');
  });

  it('identify підписує людину номером заявки', async () => {
    identifyPlayer(47, { level: 6, pack: 'player' });
    await settle();
    expect(h.identified[0][0]).toBe('dbc-player-47');
    expect(h.identified[0][1]).toMatchObject({ level: 6, pack: 'player' });
  });

  it('без номера не підписуємо — краще анонім, ніж чужий id', async () => {
    identifyPlayer(0);
    await settle();
    expect(h.identified).toHaveLength(0);
  });
});

describe('події', () => {
  it('джерело cabinet стоїть super-властивістю — тоді й $pageview його має', async () => {
    track('cabinet_opened');
    await settle();
    expect(h.registered[0][0]).toMatchObject({ entry: 'cabinet' });
  });

  it('кожна подія позначена джерелом cabinet', async () => {
    track('pay_clicked', { amount: 420 });
    await settle();
    expect(h.captured[0][0]).toBe('pay_clicked');
    expect(h.captured[0][1]).toMatchObject({ entry: 'cabinet', amount: 420 });
  });

  it('перед відходом у банк подія йде миттєво через sendBeacon', async () => {
    track('pay_redirected', { amount: 420 }, true);
    await settle();
    expect(h.captured[0][2]).toMatchObject({ send_instantly: true, transport: 'sendBeacon' });
  });

  it('звичайна подія не форсує відправку', async () => {
    track('cabinet_opened');
    await settle();
    expect(h.captured[0][2]).toBeUndefined();
  });

  it('джерело можна перекрити явно, але за замовчуванням воно є', async () => {
    track('pay_clicked', { entry: 'chat' });
    await settle();
    expect((h.captured[0][1] as Record<string, unknown>).entry).toBe('chat');
  });
});

describe('аналітика не ламає кабінет', () => {
  it('падіння capture не кидає виняток назовні', async () => {
    h.breakCapture.on = true;
    expect(() => track('pay_clicked')).not.toThrow();
    await settle();
    expect(h.captured).toHaveLength(0);
  });

  it('падіння identify не кидає виняток назовні', async () => {
    h.breakCapture.on = true;
    expect(() => identifyPlayer(47)).not.toThrow();
    await settle();
  });
});

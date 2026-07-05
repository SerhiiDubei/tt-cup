# «Стіл» — електронна черга · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Планшет-кіоск `/table` у tt-cup: електронна черга на стіл (1v1), ввід рахунку по сетах, лідерборд — за спекою `docs/superpowers/specs/2026-07-05-table-queue-design.md`.

**Architecture:** Нові таблиці `tt_casual_games` + `tt_table_queue` (+ `tt_players.casual`), server-side API `/api/table/*` через `supaServer` (RLS без політик, як у решті), чиста бізнес-логіка у `src/lib/table/*` під vitest, клієнт — полінг `GET /api/table/state` кожні 3с. Кіоск-сторінка поза route group `(site)`, куди переїжджають Chrome/Nav/Footer.

**Tech Stack:** Next.js 16 (App Router), Supabase (supabase-js, secret key server-side), Tailwind v4 + Memphis-система з `globals.css`, vitest.

**Конвенції репо (обов'язково):**
- Alias `@/*` → `src/*`. Тести — `src/**/*.test.ts`, `environment: node`, запуск `npm test`.
- API-роути: `export const dynamic = 'force-dynamic'`, помилки `NextResponse.json({ error: 'snake_code' }, { status })`.
- Мова UI — українська. Дизайн — тільки токени/класи з `globals.css` (cream/ink, `--shadow`, Unbounded/Onest).
- Коміти: короткий conventional-префікс (`feat:`, `docs:`, `refactor:`), як в історії.

---

## Мапа файлів

**Нові:**

| Файл | Відповідальність |
|---|---|
| `supabase/migrations/2026-07-05_table_queue.sql` | таблиці + `casual` + індекси |
| `src/lib/table/types.ts` | `CasualGame`, `QueueEntry`, `TableState` |
| `src/lib/table/scoring.ts` | валідація сетів + переможець матчу (pure) |
| `src/lib/table/leaderboard.ts` | W-L + streak з ігор (pure) |
| `src/lib/table/eligibility.ts` | правило «хто може стати до столу» (pure) |
| `src/lib/table/state.ts` | server: зібрати `TableState` з БД |
| `src/lib/table/api.ts` | client: fetch-обгортки `/api/table/*` |
| `src/lib/art-url.ts` | перевірка, що `art` — URL нашого сторіджа |
| `src/app/api/table/{state,start,finish,cancel}/route.ts` | ігрові роути |
| `src/app/api/table/queue/{join,leave}/route.ts` | черга |
| `src/app/api/table/player/route.ts` + `player/avatar/route.ts` | quick-add + фоновий арт |
| `src/app/table/page.tsx` + `table.css` | кіоск-сторінка |
| `src/components/table/Kiosk.tsx` | стан-машина + полінг + wake lock |
| `src/components/table/PlayerPicker.tsx` | вибір 1–2 гравців + «Я тут вперше» |
| `src/components/table/ScoreEntry.tsx` | степпери сетів |
| `src/components/table/WhoNext.tsx` | «Хто далі?» |
| `src/components/table/Leaderboard.tsx` | вкладка лідерборду |

**Змінювані:** `src/lib/tournament/types.ts` (Player.casual), `src/lib/tournament/standings.ts` (+`tournamentPlayers`, фільтр), `src/app/api/admin/[action]/route.ts` (фільтр у жеребкуванні), `src/app/api/register/route.ts` (реюз `art-url`), `src/app/layout.tsx` → route group `(site)`, `src/components/chrome/Nav.tsx` (лінк «Стіл»).

---

### Task 1: Міграція БД

**Files:**
- Create: `supabase/migrations/2026-07-05_table_queue.sql`

- [ ] **Step 1: Написати міграцію**

```sql
create table if not exists public.tt_casual_games (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.tt_players(id) on delete cascade,
  b uuid not null references public.tt_players(id) on delete cascade,
  sets jsonb not null default '[]'::jsonb,   -- [[11,9],[7,11],...] очки a:b
  winner uuid references public.tt_players(id),
  status text not null default 'active' check (status in ('active','done','cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
-- один стіл → максимум одна активна гра
create unique index if not exists tt_casual_one_active
  on public.tt_casual_games ((true)) where status = 'active';
create index if not exists tt_casual_done_idx
  on public.tt_casual_games (ended_at desc) where status = 'done';

create table if not exists public.tt_table_queue (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.tt_players(id) on delete cascade,
  joined_at timestamptz not null default now()
);

alter table public.tt_players add column if not exists casual boolean not null default false;

alter table public.tt_casual_games enable row level security;
alter table public.tt_table_queue enable row level security;
-- no policies = no anon access; server secret key bypasses RLS (як у tt_init)
```

- [ ] **Step 2: Застосувати міграцію**

Run: `cd "/Users/serhiidubei/UI UX PRO MAX/tt-cup" && PG_URL="<з .env.local / Supabase dashboard>" node scripts/apply-migration.mjs supabase/migrations/2026-07-05_table_queue.sql`
Expected: `OK — tt_ tables: tt_casual_games, tt_matches, tt_players, tt_table_queue, tt_tournament`
(Якщо PG_URL немає під рукою — спитати користувача; НЕ вигадувати.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026-07-05_table_queue.sql
git commit -m "feat: table queue schema (casual games, queue, players.casual)"
```

---

### Task 2: `Player.casual` + фільтр турнірних гравців

**Files:**
- Modify: `src/lib/tournament/types.ts:2`
- Modify: `src/lib/tournament/standings.ts`
- Test: `src/lib/tournament/standings.test.ts` (додати кейс)

- [ ] **Step 1: Додати поле в тип**

У `types.ts` рядок `Player`: додати `casual?: boolean`:

```ts
export type Player = { id: string; name: string; nickname: string; hero: Hero; motto?: string; seed: number; casual?: boolean };
```

- [ ] **Step 2: Failing test — casual не потрапляє в standings**

У `standings.test.ts` додати (використати ту саму фабрику гравців, що вже є у файлі; якщо фабрики нема — мінімальний inline-об'єкт `Player`):

```ts
it('excludes casual players from standings', () => {
  const players = [P('a'), P('b'), { ...P('c'), casual: true }];
  const rows = computeStandings(players, []);
  expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b']);
});
```

- [ ] **Step 3: Run** `npm test -- standings` → Expected: FAIL (casual гравець у таблиці)

- [ ] **Step 4: Імплементація**

У `standings.ts` додати експорт і фільтр на вході `computeStandings`:

```ts
/** Гравці, що беруть участь у турнірі (кіоскові casual-гравці не рахуються). */
export const tournamentPlayers = (players: Player[]) => players.filter((p) => !p.casual);
```

Першим рядком `computeStandings`: `players = tournamentPlayers(players);`

- [ ] **Step 5: Run** `npm test` → Expected: усі PASS (існуючі тести без casual не зачеплені)

- [ ] **Step 6: Commit** — `feat: casual flag excluded from tournament standings`

---

### Task 3: Фільтр casual у турнірних admin-діях

**Files:**
- Modify: `src/app/api/admin/[action]/route.ts` (дії `start` ~:37, `next-round` ~:50, `to-playoff` ~:61)

- [ ] **Step 1: Імпорт і фільтр**

`import { tournamentPlayers } from '@/lib/tournament/standings';` і в трьох діях замінити використання `players` на `tournamentPlayers(players)`:
- `start`: перевірка `length < 2` і `generateSwissRound(...)`
- `next-round`: `generateSwissRound(...)`
- `to-playoff`: `seedPlayoff(...)`
(`advance` гравців не читає — не чіпати.)

- [ ] **Step 2: Перевірка компіляції** — `npx tsc --noEmit` → Expected: 0 errors

- [ ] **Step 3: Commit** — `feat: exclude casual players from swiss pairing and playoff seeding`

---

### Task 4: `lib/table/scoring` — валідація сетів + переможець

**Files:**
- Create: `src/lib/table/types.ts`, `src/lib/table/scoring.ts`
- Test: `src/lib/table/scoring.test.ts`

- [ ] **Step 1: Типи**

```ts
// src/lib/table/types.ts
import type { SetScore } from '@/lib/tournament/types';

export type CasualGame = {
  id: string; a: string; b: string;
  sets: SetScore[]; winner: string | null;
  status: 'active' | 'done' | 'cancelled';
  started_at: string; ended_at: string | null;
};
export type QueueEntry = { id: string; player_id: string; joined_at: string };
export type LeaderRow = { id: string; wins: number; losses: number; streak: number };
```

- [ ] **Step 2: Failing tests**

```ts
// src/lib/table/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { validateSets, casualWinner } from './scoring';

describe('validateSets', () => {
  it('rejects empty', () => expect(validateSets([])).toBe('no_sets'));
  it('rejects tied set', () => expect(validateSets([[11, 11]])).toBe('set_tied'));
  it('rejects out of range', () => expect(validateSets([[100, 1]])).toBe('bad_points'));
  it('rejects non-integers', () => expect(validateSets([[10.5, 1] as never])).toBe('bad_points'));
  it('rejects tied match (equal set wins)', () => expect(validateSets([[11, 5], [5, 11]])).toBe('match_tied'));
  it('accepts valid match', () => expect(validateSets([[11, 9], [7, 11], [12, 10]])).toBeNull());
});

describe('casualWinner', () => {
  it('a wins 2-1', () => expect(casualWinner('A', 'B', [[11, 9], [7, 11], [11, 5]])).toBe('A'));
  it('b wins 0-1', () => expect(casualWinner('A', 'B', [[3, 11]])).toBe('B'));
});
```

- [ ] **Step 3: Run** `npm test -- table/scoring` → FAIL (module not found)

- [ ] **Step 4: Імплементація**

```ts
// src/lib/table/scoring.ts
import type { SetScore } from '@/lib/tournament/types';

const MAX_POINTS = 99;

/** null = ok, інакше snake_code помилки (той самий код летить у API 4xx). */
export function validateSets(sets: SetScore[]): string | null {
  if (!Array.isArray(sets) || sets.length === 0) return 'no_sets';
  for (const s of sets) {
    if (!Array.isArray(s) || s.length !== 2) return 'bad_points';
    const [x, y] = s;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return 'bad_points';
    if (x < 0 || y < 0 || x > MAX_POINTS || y > MAX_POINTS) return 'bad_points';
    if (x === y) return 'set_tied';
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
```

- [ ] **Step 5: Run** `npm test` → PASS
- [ ] **Step 6: Commit** — `feat: casual game set validation and winner`

---

### Task 5: `lib/table/leaderboard`

**Files:**
- Create: `src/lib/table/leaderboard.ts`
- Test: `src/lib/table/leaderboard.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { computeLeaderboard } from './leaderboard';
import type { CasualGame } from './types';

const g = (a: string, b: string, winner: string, endedAt: string): CasualGame => ({
  id: endedAt, a, b, sets: [[11, 0]], winner, status: 'done', started_at: endedAt, ended_at: endedAt,
});

describe('computeLeaderboard', () => {
  it('counts wins/losses and sorts by wins', () => {
    const rows = computeLeaderboard([
      g('A', 'B', 'A', '2026-07-01T10:00:00Z'),
      g('A', 'C', 'A', '2026-07-01T11:00:00Z'),
      g('B', 'C', 'C', '2026-07-01T12:00:00Z'),
    ]);
    expect(rows[0]).toMatchObject({ id: 'A', wins: 2, losses: 0 });
    expect(rows.find((r) => r.id === 'B')).toMatchObject({ wins: 0, losses: 2 });
  });
  it('streak = consecutive wins in latest games, resets on loss', () => {
    const rows = computeLeaderboard([
      g('A', 'B', 'B', '2026-07-01T10:00:00Z'), // A програв (давно)
      g('A', 'B', 'A', '2026-07-01T11:00:00Z'),
      g('A', 'C', 'A', '2026-07-01T12:00:00Z'), // A: 2 останні перемоги → streak 2
    ]);
    expect(rows.find((r) => r.id === 'A')!.streak).toBe(2);
    expect(rows.find((r) => r.id === 'B')!.streak).toBe(0);
  });
  it('ignores cancelled/active games', () => {
    const rows = computeLeaderboard([{ ...g('A', 'B', 'A', 'x'), status: 'cancelled' }]);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Імплементація**

```ts
// src/lib/table/leaderboard.ts
import type { CasualGame, LeaderRow } from './types';

/** W-L і поточний вінстрік з done-ігор. Гравці без ігор не потрапляють у рядки. */
export function computeLeaderboard(games: CasualGame[]): LeaderRow[] {
  const done = games
    .filter((x) => x.status === 'done' && x.winner)
    .sort((x, y) => (x.ended_at! < y.ended_at! ? -1 : 1)); // старі → нові
  const rows = new Map<string, LeaderRow>();
  const row = (id: string) => {
    if (!rows.has(id)) rows.set(id, { id, wins: 0, losses: 0, streak: 0 });
    return rows.get(id)!;
  };
  for (const gm of done) {
    const w = row(gm.winner!), l = row(gm.winner === gm.a ? gm.b : gm.a);
    w.wins++; w.streak++;
    l.losses++; l.streak = 0;
  }
  return [...rows.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses);
}
```

- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: casual leaderboard aggregation`

---

### Task 6: `lib/table/eligibility` — хто може стати до столу

**Files:**
- Create: `src/lib/table/eligibility.ts`
- Test: `src/lib/table/eligibility.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { startError } from './eligibility';

describe('startError', () => {
  it('same player twice', () => expect(startError('A', 'A', [], null)).toBe('same_player'));
  it('empty queue → anyone', () => expect(startError('A', 'B', [], null)).toBeNull());
  it('non-empty queue → both must be queued', () =>
    expect(startError('A', 'X', ['A', 'B'], null)).toBe('not_in_queue'));
  it('last winner is exempt', () =>
    expect(startError('W', 'A', ['A', 'B'], 'W')).toBeNull());
  it('two from queue ok', () => expect(startError('A', 'B', ['A', 'B', 'C'], 'W')).toBeNull());
  it('last winner rule covers only the winner', () =>
    expect(startError('W', 'X', ['A'], 'W')).toBe('not_in_queue'));
});
```

- [ ] **Step 2: Run** → FAIL

- [ ] **Step 3: Імплементація**

```ts
// src/lib/table/eligibility.ts

/**
 * Правило старту гри (спека §3/§6): якщо черга непорожня, кожен з гравців має
 * бути в черзі АБО бути переможцем останньої done-гри («переможець лишається»).
 * null = можна, інакше snake_code для API.
 */
export function startError(
  a: string, b: string, queueIds: string[], lastWinner: string | null
): string | null {
  if (a === b) return 'same_player';
  if (queueIds.length === 0) return null;
  const ok = (p: string) => queueIds.includes(p) || p === lastWinner;
  return ok(a) && ok(b) ? null : 'not_in_queue';
}
```

- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: table start eligibility rule`

---

### Task 7: Server state loader + `GET /api/table/state`

**Files:**
- Create: `src/lib/table/state.ts`, `src/app/api/table/state/route.ts`

- [ ] **Step 1: Loader (за зразком `src/lib/state.ts`)**

```ts
// src/lib/table/state.ts
import { supaServer } from '@/lib/supabase/server';
import { publicPlayers } from '@/lib/state';
import { computeLeaderboard } from './leaderboard';
import type { CasualGame, QueueEntry } from './types';
import type { Player } from '@/lib/tournament/types';

const RECENT_LIMIT = 20;

export async function loadTableState() {
  const s = supaServer();
  const [players, active, done, queue] = await Promise.all([
    s.from('tt_players').select('*').order('created_at', { ascending: true }),
    s.from('tt_casual_games').select('*').eq('status', 'active').maybeSingle(),
    s.from('tt_casual_games').select('*').eq('status', 'done')
      .order('ended_at', { ascending: false }).limit(500),
    s.from('tt_table_queue').select('*').order('joined_at', { ascending: true }),
  ]);
  const doneGames = (done.data as CasualGame[]) ?? [];
  return {
    game: (active.data as CasualGame | null) ?? null,
    queue: (queue.data as QueueEntry[]) ?? [],
    players: publicPlayers((players.data as (Player & { token?: string })[]) ?? []),
    leaderboard: computeLeaderboard(doneGames),
    recent: doneGames.slice(0, RECENT_LIMIT),
    lastWinner: doneGames[0]?.winner ?? null,
  };
}
export type TableState = Awaited<ReturnType<typeof loadTableState>>;
```

- [ ] **Step 2: Роут (за зразком `api/state/route.ts`)**

```ts
// src/app/api/table/state/route.ts
import { NextResponse } from 'next/server';
import { loadTableState } from '@/lib/table/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await loadTableState());
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Перевірити вручну** — `npm run dev`, `curl -s localhost:3000/api/table/state` → JSON з `game:null, queue:[], players:[...], leaderboard:[], recent:[], lastWinner:null`
- [ ] **Step 4: Commit** — `feat: table state endpoint`

---

### Task 8: Роути черги — join / leave

**Files:**
- Create: `src/app/api/table/queue/join/route.ts`, `src/app/api/table/queue/leave/route.ts`

- [ ] **Step 1: join**

```ts
// src/app/api/table/queue/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { playerId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const playerId = body.playerId ?? '';
  if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });

  const s = supaServer();
  const { data: active } = await s.from('tt_casual_games')
    .select('a,b').eq('status', 'active').maybeSingle();
  if (active && (active.a === playerId || active.b === playerId))
    return NextResponse.json({ error: 'currently_playing' }, { status: 409 });

  const { error } = await s.from('tt_table_queue').insert({ player_id: playerId });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'already_queued' }, { status: 409 });
    if (error.code === '23503') return NextResponse.json({ error: 'no_such_player' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: leave**

```ts
// src/app/api/table/queue/leave/route.ts — той самий каркас;
// delete from tt_table_queue where player_id = playerId; select('id') → 0 рядків = 404 'not_queued'
import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { playerId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const playerId = body.playerId ?? '';
  if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });
  const { data, error } = await supaServer()
    .from('tt_table_queue').delete().eq('player_id', playerId).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'not_queued' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Ручна перевірка** (dev-сервер): join двічі тим самим id → друга відповідь 409 `already_queued`; leave → ok; leave знову → 404.
- [ ] **Step 4: Commit** — `feat: queue join/leave endpoints`

---

### Task 9: Роути гри — start / finish / cancel

**Files:**
- Create: `src/app/api/table/start/route.ts`, `src/app/api/table/finish/route.ts`, `src/app/api/table/cancel/route.ts`

- [ ] **Step 1: start**

```ts
// src/app/api/table/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { startError } from '@/lib/table/eligibility';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { a?: string; b?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { a = '', b = '' } = body;
  if (!a || !b) return NextResponse.json({ error: 'players_required' }, { status: 400 });

  const s = supaServer();
  const [queue, last] = await Promise.all([
    s.from('tt_table_queue').select('player_id'),
    s.from('tt_casual_games').select('winner').eq('status', 'done')
      .order('ended_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const queueIds = (queue.data ?? []).map((q) => q.player_id as string);
  const err = startError(a, b, queueIds, (last.data?.winner as string) ?? null);
  if (err) return NextResponse.json({ error: err }, { status: 409 });

  // Унікальний індекс tt_casual_one_active ловить гонку двох одночасних стартів.
  const { data, error } = await s.from('tt_casual_games')
    .insert({ a, b }).select('id').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'table_busy' }, { status: 409 });
    if (error.code === '23503') return NextResponse.json({ error: 'no_such_player' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await s.from('tt_table_queue').delete().in('player_id', [a, b]);
  return NextResponse.json({ id: data!.id });
}
```

- [ ] **Step 2: finish**

```ts
// src/app/api/table/finish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { validateSets, casualWinner } from '@/lib/table/scoring';
import type { SetScore } from '@/lib/tournament/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { gameId?: string; sets?: SetScore[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { gameId = '', sets = [] } = body;
  if (!gameId) return NextResponse.json({ error: 'game_required' }, { status: 400 });
  const invalid = validateSets(sets);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const s = supaServer();
  const { data: game } = await s.from('tt_casual_games')
    .select('a,b').eq('id', gameId).eq('status', 'active').maybeSingle();
  if (!game) return NextResponse.json({ error: 'not_active' }, { status: 409 });

  const winner = casualWinner(game.a, game.b, sets);
  // умова status='active' в update → друга паралельна спроба отримає 0 рядків
  const { data: upd, error } = await s.from('tt_casual_games')
    .update({ sets, winner, status: 'done', ended_at: new Date().toISOString() })
    .eq('id', gameId).eq('status', 'active').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!upd?.length) return NextResponse.json({ error: 'not_active' }, { status: 409 });
  return NextResponse.json({ winner });
}
```

- [ ] **Step 3: cancel** — той самий каркас, що `finish`, без сетів: `update({ status: 'cancelled', ended_at }) .eq('id', gameId).eq('status','active').select('id')`; 0 рядків → 409 `not_active`; відповідь `{ ok: true }`.

- [ ] **Step 4: Ручна перевірка сценарію (dev):** start(A,B) → state показує гру; повторний start → 409 `table_busy`; finish з `[[11,9],[9,11]]` → 400 `match_tied`; finish з `[[11,9]]` → `{winner:A}`; cancel по done-грі → 409.
- [ ] **Step 5: Commit** — `feat: game start/finish/cancel endpoints`

---

### Task 10: Quick-add гравця + фоновий арт

**Files:**
- Create: `src/lib/art-url.ts`, `src/app/api/table/player/route.ts`, `src/app/api/table/player/avatar/route.ts`
- Modify: `src/app/api/register/route.ts:16,24` (реюз хелпера)

- [ ] **Step 1: Хелпер art-url**

```ts
// src/lib/art-url.ts
export const ART_MAX = 300;
const STORAGE_PREFIX = () =>
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '') + '/storage/v1/object/public/tt-avatars/';

/** art приймається ТІЛЬКИ як публічний URL нашого бакета tt-avatars (спека §6). */
export function isValidArtUrl(art: unknown): art is string {
  return typeof art === 'string' && art.startsWith(STORAGE_PREFIX()) && art.length <= ART_MAX;
}
```

У `register/route.ts` замінити локальні `ART_MAX`/`STORAGE_PREFIX`/рядок 24 на `isValidArtUrl`:
`const art = isValidArtUrl(h.art) ? h.art : '';` (імпорт з `@/lib/art-url`); локальні консти `ART_MAX` і `STORAGE_PREFIX` **видалити** (інакше лінт лаятиметься на unused). Запустити `npm test` + `npx tsc --noEmit`.

- [ ] **Step 2: player (quick-add)**

```ts
// src/app/api/table/player/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { PALETTE, SHAPES, STYLES } from '@/config';

export const dynamic = 'force-dynamic';
const NAME_MAX = 60, NICK_MAX = 30;

export async function POST(req: NextRequest) {
  let body: { name?: string; style?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const name = (body.name ?? '').trim();
  const nickname = name.replace(/\s+/g, '_').slice(0, NICK_MAX); // нормалізація як у register
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  if (name.length > NAME_MAX) return NextResponse.json({ error: 'name_too_long' }, { status: 400 });
  const style = STYLES.includes(body.style as never) ? (body.style as string) : 'allrounder';
  // герой-заглушка: колір з палітри за довжиною імені, без art (з'явиться фоново)
  const hero = { color: PALETTE[name.length % PALETTE.length], shape: SHAPES[0], style, emblem: '', art: '' };

  const { data, error } = await supaServer().from('tt_players')
    .insert({ name, nickname, hero, seed: 0, casual: true })
    .select('id').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'nick_taken' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data!.id }); // токен НЕ повертаємо (спека §6)
}
```

- [ ] **Step 3: player/avatar**

```ts
// src/app/api/table/player/avatar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supaServer } from '@/lib/supabase/server';
import { isValidArtUrl } from '@/lib/art-url';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { playerId?: string; art?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  const { playerId = '', art } = body;
  if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });
  if (!isValidArtUrl(art)) return NextResponse.json({ error: 'bad_art' }, { status: 400 });

  const s = supaServer();
  const { data: p } = await s.from('tt_players').select('hero').eq('id', playerId).maybeSingle();
  if (!p) return NextResponse.json({ error: 'no_such_player' }, { status: 404 });
  const { error } = await s.from('tt_players')
    .update({ hero: { ...(p.hero as object), art } }).eq('id', playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Ручна перевірка:** POST /player `{name:"Іван Петренко"}` → id, у state гравець з nickname `Іван_Петренко`, casual, hero без art; /player/avatar з лівим URL → 400 `bad_art`.
- [ ] **Step 5: Commit** — `feat: kiosk quick-add player + background avatar write`

---

### Task 11: Route group `(site)` + лінк «Стіл»

**Files:**
- Create: `src/app/(site)/layout.tsx`
- Move: усі сторінкові папки й `page.tsx` (НЕ `api/`, НЕ `globals.css`, НЕ `layout.tsx`) → `src/app/(site)/`
- Modify: `src/app/layout.tsx`, `src/components/chrome/Nav.tsx:17`

- [ ] **Step 1: Перемістити сторінки**

```bash
cd "/Users/serhiidubei/UI UX PRO MAX/tt-cup/src/app"
mkdir "(site)"
git mv page.tsx how players register standings schedule bracket cup admin me "(site)/"
```

- [ ] **Step 2: Новий layout групи**

```tsx
// src/app/(site)/layout.tsx — сайтовий хром (прелоадер/курсор/нав/футер)
import Chrome from '@/components/chrome/Chrome';
import Nav from '@/components/chrome/Nav';
import Footer from '@/components/chrome/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Chrome />
      <Nav />
      {children}
      <Footer />
    </>
  );
}
```

У кореневому `src/app/layout.tsx` прибрати імпорти/рендер `Chrome`, `Nav`, `Footer` — лишити `<html>`, шрифти, `globals.css`, `{children}`. Metadata не чіпати.

- [ ] **Step 3: Лінк у Nav**

У `Nav.tsx` до базових лінків додати: `['/table', 'Стіл']` (після `'🏆 Кубок'`).
(Лінк тимчасово вестиме на 404, поки Task 13 не створить сторінку — це ок при послідовному виконанні.)

- [ ] **Step 4: Перевірка** — `npm run build` → Expected: build OK, у списку роутів усі старі шляхи (`/`, `/how`, `/players`…) без зміни URL. Відкрити dev: головна виглядає як раніше (нав/футер/прелоадер на місці).
- [ ] **Step 5: Commit** — `refactor: move site chrome into (site) route group`

---

### Task 12: Клієнтський шар — fetch-обгортки

**Files:**
- Create: `src/lib/table/api.ts`

- [ ] **Step 1: Обгортки (каркас `jpost` скопіювати НЕ треба — реекспортувати не можна, він приватний; зробити локальний аналог)**

```ts
// src/lib/table/api.ts
import type { SetScore } from '@/lib/tournament/types';
import type { TableState } from './state';

async function jpost(url: string, body: unknown, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('timeout');
    throw e;
  } finally { clearTimeout(id); }
}

export async function getTableState(): Promise<TableState> {
  const r = await fetch('/api/table/state', { cache: 'no-store' });
  if (!r.ok) throw new Error('state_failed');
  return r.json();
}
export const startGame = (a: string, b: string) => jpost('/api/table/start', { a, b }) as Promise<{ id: string }>;
export const finishGame = (gameId: string, sets: SetScore[]) => jpost('/api/table/finish', { gameId, sets }) as Promise<{ winner: string }>;
export const cancelGame = (gameId: string) => jpost('/api/table/cancel', { gameId });
export const joinQueue = (playerId: string) => jpost('/api/table/queue/join', { playerId });
export const leaveQueue = (playerId: string) => jpost('/api/table/queue/leave', { playerId });
export const quickAddPlayer = (name: string, style?: string) => jpost('/api/table/player', { name, style }) as Promise<{ id: string }>;
export const setPlayerArt = (playerId: string, art: string) => jpost('/api/table/player/avatar', { playerId, art });
```

- [ ] **Step 2:** `npx tsc --noEmit` → 0 errors. Commit — `feat: table client api`

---

### Task 13: Кіоск UI

**Files:**
- Create: `src/app/table/page.tsx`, `src/app/table/table.css`, `src/components/table/Kiosk.tsx`, `PlayerPicker.tsx`, `ScoreEntry.tsx`, `WhoNext.tsx`, `Leaderboard.tsx`

Це найбільший таск — UI-композиція навмисно описана контрактами й критеріями, а не JSX-у-плані: виконавець працює в існуючій Memphis-системі (`globals.css`) і слідує спеці §7–§8. REQUIRED SUB-SKILL для цього таска: `frontend-design:frontend-design`.

**Контракти компонентів (props — точні):**

```ts
// Kiosk.tsx ('use client') — корінь: полінг + стан-машина + вкладки
//   view: 'table' | 'board'; крокові оверлеї: 'picker' | 'score' | 'whonext' | null
// PlayerPicker: {
//   players: Player[]; allowedIds?: string[]; // undefined = весь пул
//   count: 1 | 2; preselected?: string[];
//   title: string; confirmLabel: string;
//   onConfirm(ids: string[]): void; onClose(): void;
//   quickAdd?: boolean; // показати картку «Я тут вперше +»
// }
// ScoreEntry: { a: Player; b: Player; onSubmit(sets: SetScore[]): Promise<void>; onCancel(): void }
// WhoNext: { winner: Player; loser: Player; sets: SetScore[]; queue: Player[];
//            onStart(a: string, b: string): Promise<void>; onLater(): void }
// Leaderboard: { rows: LeaderRow[]; players: Map<string, Player>; recent: CasualGame[] }
```

**Поведінка Kiosk (стан-машина зі спеки §7):**
- Полінг: `getTableState()` кожні 3000мс (`setInterval`), стоп при `document.hidden` (`visibilitychange`), негайний рефетч після кожної успішної дії.
- Wake Lock: `navigator.wakeLock?.request('screen')` при маунті + повторно на `visibilitychange` (try/catch, без падінь у браузерах без підтримки).
- `game == null` → екран «СТІЛ ВІЛЬНИЙ»: гігантська кнопка «СТАТИ ДО СТОЛУ» (picker: `allowedIds` = черга, якщо вона непорожня, інакше весь пул; `count: 2`, `preselected` = перші двоє черги) + «ЗАПИСАТИСЬ У ЧЕРГУ» (якщо черга непорожня або хочуть чекати) + список черги.
- `game != null` → дві герой-картки (реюз `HeroArt` для аватарок; ім'я = nickname) + «VS», таймер `mm:ss` від `started_at` (tick 1с), черга з позиціями та ✕ (confirm), кнопки «ГРА ЗАКІНЧИЛАСЬ» → ScoreEntry, «ЗАПИСАТИСЬ У ЧЕРГУ» → picker (`count:1`, весь пул мінус гравці за столом і вже в черзі, `quickAdd:true`), «Скасувати гру» (мала, confirm → `cancelGame`).
- ScoreEntry: список сетів (перший додано одразу, дефолт 11:9), степпери «+/−» ≥64px, «+ сет», «Завершити» активна лише коли `validateSets(sets) == null` (імпорт тієї САМОЇ функції з `@/lib/table/scoring` — одна логіка на клієнті й сервері); сабміт → `finishGame` → WhoNext (якщо черга непорожня, інакше назад).
- WhoNext: великий результат + 2 варіанти: «Переможець лишається» (picker суперника: `allowedIds` = черга, `count:1`, перший передвибраний → `onStart(winner, opp)`), «Обидва йдуть» (picker: `allowedIds` = черга, `count:2`, перші двоє передвибрані), «Пізніше» → головний екран.
- PlayerPicker quick-add флоу: «Я тут вперше +» → ім'я (input) → SelfieCapture (реюз, кнопка «Пропустити») → 4 великі кнопки стилю (лейбли як на `register/page.tsx`) → «Готово»: `quickAddPlayer` МИТТЄВО (гравець вибраний, оверлей закривається), якщо селфі є — у фоні `stylizeSelfie(selfie, style)` (з `@/lib/api`) → `setPlayerArt(id, url)`; помилки фону — ігноруються тихо (лишиться заглушка).
- Усі кнопки дій: `disabled` поки запит летить; помилка API → великий тост-бар зверху з текстом українською + авто-рефетч стану (спека §4: 409 = «стан змінився, синхронізуюсь»).
- Подвійне підтвердження (вихід з черги, скасування гри): другий тап по тій самій кнопці протягом 4с («Точно?»), не системний confirm().

**Стиль (`table.css`, імпорт у `page.tsx`):** тільки поверх Memphis-токенів: `--bg/--paper/--ink/--pink/--cyan/--yellow`, `--shadow`, `--radius`, Unbounded для цифр рахунку і заголовків. Тап-таргети ≥64px, шрифт черги ≥28px, landscape-first + робочий portrait. Без hover-ефектів — тільки `:active` (scale .97).

**`page.tsx`:**

```tsx
import Kiosk from '@/components/table/Kiosk';
import './table.css';

export const metadata = { title: 'Стіл — черга' };
export default function TablePage() { return <Kiosk />; }
```

- [ ] **Step 1:** Kiosk.tsx + page.tsx + table.css — головний екран обох станів (без оверлеїв), полінг + wake lock. Перевірка: dev, два вікна браузера — зміна стану видна в другому ≤3с (join робити через `curl /api/table/queue/join`, бо UI-кнопка з'явиться у Step 2).
- [ ] **Step 2:** PlayerPicker (без quick-add) + інтеграція «СТАТИ ДО СТОЛУ»/«ЗАПИСАТИСЬ У ЧЕРГУ»/✕. Перевірка: старт гри з пікера, черга оновлюється, ✕ з подвійним тапом.
- [ ] **Step 3:** ScoreEntry + WhoNext. Перевірка повного циклу: гра → рахунок → «Переможець лишається» → нова гра; «Обидва йдуть»; «Пізніше».
- [ ] **Step 4:** Quick-add у PlayerPicker (ім'я → селфі → стиль → миттєве створення, фонова генерація). Перевірка: гравець з'являється одразу із заглушкою; (якщо є OPENROUTER ключ у dev) арт підтягується полінгом за ~хвилину.
- [ ] **Step 5:** Leaderboard вкладка + перемикач вкладок. Перевірка: W-L і streak відповідають зіграним іграм, стрічка recent з рахунками.
- [ ] **Step 6:** Мобільний прохід (portrait, ~390px): нічого не ламається, скрол ок.
- [ ] **Step 7:** Commit по кожному кроку (`feat: kiosk shell`, `feat: player picker`, `feat: score entry + who-next`, `feat: quick add flow`, `feat: leaderboard tab`, `fix: portrait pass`).

---

### Task 14: Фінальна верифікація

- [ ] **Step 1:** `npm test` → всі PASS. `npm run build` → OK, роути: старі без змін + `/table` + 8 нових `/api/table/*`.
- [ ] **Step 2:** E2E-прохід за сценарієм спеки на dev (браузер, розмір планшета ~1180×820):
  1. Пустий стан → «СТАТИ ДО СТОЛУ» → двоє з пулу → гра йде.
  2. Записати трьох у чергу (один — новий через «Я тут вперше», без селфі).
  3. «ГРА ЗАКІНЧИЛАСЬ» → 3 сети → «Переможець лишається» + перший з черги.
  4. «ГРА ЗАКІНЧИЛАСЬ» → 1 сет → «Обидва йдуть» → наступні двоє.
  5. Вихід з черги через ✕. «Скасувати гру» → стіл вільний, в історії скасованої нема.
  6. Лідерборд: W-L/streak коректні; те саме видно з «телефонного» вікна (390px).
  7. Турнірна перевірка не зламана: `/standings` рендериться, casual-гравця в таблиці нема.
- [ ] **Step 3:** Commit фіналу + повідомити користувачу про готовність до деплою (Vercel деплоїться з цього ж проєкту; migration вже застосована в Task 1).

**Поза скоупом плану (свідомо):** деплой на Vercel і фізичне налаштування планшета (fullscreen/guided access) — окремим кроком після приймання.

# Настільний теніс — турнір · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Побудувати сайт турніру з настільного тенісу (реєстрація через hero-білдер → швейцарка 8 турів → топ-8 плей-офф → чемпіон) у Memphis-стилі super-vision, на Next.js + Supabase.

**Architecture:** Next.js (App Router) + TS + Tailwind. Уся мутація даних — серверні route handlers із Supabase secret key (RLS-safe), як у First Wind. Чиста турнірна логіка — окремі модулі під vitest. Спільна Supabase (`nitlmgcxdcwtbzfwlhug`), дані відділені префіксом `tt_`. Публічне читання — через сервер-снапшот `/api/state`. Ідентифікація гравця — приватний токен-лінк. Деплой — окремий Vercel-проєкт.

**Tech Stack:** Next.js 14/15 (App Router), TypeScript, Tailwind CSS, @supabase/supabase-js, vitest. Шрифти Unbounded + Onest. Стиль — Memphis (cream/ink + bright accents).

**Spec:** `docs/superpowers/specs/2026-06-27-table-tennis-tournament-design.md`

**Корінь проєкту:** `tt-cup/` (всі шляхи нижче — відносно нього).

---

## File Structure

```
tt-cup/
├── package.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts
├── .env.local                      # копія Supabase-ключів з ../ODESA FEST/.env.local (НЕ комітити)
├── .gitignore
├── supabase/migrations/2026..._tt_init.sql
├── src/
│   ├── config.ts                   # BRAND, TOTAL_ROUNDS, REG_DEADLINE, ADMIN_CODE, MEMPHIS palette consts
│   ├── lib/
│   │   ├── supabase/server.ts      # серверний клієнт (secret key)
│   │   ├── tournament/
│   │   │   ├── scoring.ts          # best-of-5 winner/valid (pure)
│   │   │   ├── scoring.test.ts
│   │   │   ├── standings.ts        # очки + Buchholz (pure)
│   │   │   ├── standings.test.ts
│   │   │   ├── swiss.ts            # генерація пар + bye (pure)
│   │   │   ├── swiss.test.ts
│   │   │   ├── playoff.ts          # seed top-8 + advance + champion (pure)
│   │   │   ├── playoff.test.ts
│   │   │   └── types.ts            # Player, Match, Tournament TS types
│   │   └── api.ts                  # клієнтські fetch-хелпери (register, reportScore, state, admin)
│   ├── app/
│   │   ├── layout.tsx              # шрифти, globals, cursor/preloader/progress mounts
│   │   ├── globals.css             # Memphis design system (з super-vision)
│   │   ├── page.tsx                # ЛЕНДИНГ (секції)
│   │   ├── players/page.tsx
│   │   ├── me/[token]/page.tsx
│   │   ├── schedule/page.tsx
│   │   ├── standings/page.tsx
│   │   ├── bracket/page.tsx
│   │   ├── admin/page.tsx
│   │   └── api/
│   │       ├── state/route.ts
│   │       ├── register/route.ts
│   │       ├── report-score/route.ts
│   │       └── admin/[action]/route.ts   # start | next-round | to-playoff | advance
│   └── components/
│       ├── chrome/                 # Nav, CustomCursor, Preloader, ScrollProgress, DarkToggle, Footer
│       ├── ui/                     # Btn, Card, Eyebrow, Shape, Countdown, Toast, Modal
│       ├── HeroCard.tsx            # Memphis-картка гравця (з hero json)
│       ├── builder/HeroBuilder.tsx # інтерактивний конструктор → картка
│       ├── landing/                # Hero, LiveStats, FormatExplainer, Rules, Champions, Faq, Cta
│       └── app/                    # MatchCard, ScoreModal, StandingsTable, Bracket
```

Принцип: один файл = одна відповідальність. Логіку (testable) тримаємо окремо від UI.

---

## Phase 0 — Scaffold

### Task 0.1: Next.js проєкт + залежності
**Files:** Create `tt-cup/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`

- [ ] **Step 1:** З кореня workspace: `cd "tt-cup"` (вже існує з docs/). Ініціалізувати Next.js вручну (без create-next-app інтерактиву):
```bash
cd "tt-cup"
git init
npm init -y
npm i next@latest react@latest react-dom@latest @supabase/supabase-js
npm i -D typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss vitest
```
- [ ] **Step 2:** Створити `next.config.ts`:
```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;
```
- [ ] **Step 3:** `postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```
- [ ] **Step 4:** `tsconfig.json` (стандарт Next App Router; скопіювати з `../ODESA FEST/tsconfig.json` і лишити як є).
- [ ] **Step 5:** `.gitignore`:
```
node_modules
.next
.env.local
.vercel
```
- [ ] **Step 6:** У `package.json` scripts: `"dev":"next dev","build":"next build","start":"next start","test":"vitest run","test:watch":"vitest"`.
- [ ] **Step 7:** `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```
- [ ] **Step 8 (commit):** `git add -A && git commit -m "chore: scaffold next.js + tailwind + vitest"`

### Task 0.2: Env (підключення до наявної Supabase)
**Files:** Create `tt-cup/.env.local`

- [ ] **Step 1:** Скопіювати ТІЛЬКИ Supabase-ключі з `../ODESA FEST/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...        # той самий https://nitlmgcxdcwtbzfwlhug.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
ADMIN_CODE=topspin                  # змінити на власний
```
(Секрети не комітяться — `.env.local` у gitignore.)
- [ ] **Step 2 (commit):** нічого комітити (env ігнорується); крок-перевірка: `grep SUPABASE .env.local` показує 3 змінні.

### Task 0.3: Memphis design system (globals.css)
**Files:** Create `src/app/globals.css`, `src/config.ts`

- [ ] **Step 1:** Перенести Memphis-токени з `../super-vision/index.html` `<style>` у `src/app/globals.css`: CSS variables (`--bg,--ink,--pink,--cyan,--yellow,--blue,--coral,--purple,--lime,--paper,--line,--shadow,--shadow-lg,--radius,--font-display,--font-body,--ease`), `[data-theme="dark"]`, body+dotted texture, `::selection`, базові класи `.btn(.pink/.cyan/.blue/.ghost)`, `.eyebrow`, `h2.title`, `.lead`, секційний scaffold, nav/logo/icon-btn, cursor-dot/ring, preloader, scroll-progress. Tailwind підключити через `@import "tailwindcss";` зверху (Tailwind v4 + postcss).
- [ ] **Step 2:** `src/config.ts`:
```ts
export const BRAND = 'КУБОК';          // placeholder — клієнт міняє тут
export const TOTAL_ROUNDS = 8;
export const REG_DEADLINE = '2026-08-01T18:00:00Z'; // placeholder
export const PALETTE = ['#FF2E88','#00CFC1','#FFC619','#2D4BFF','#FF5A36','#8A45FF','#A6E22E'];
export const SHAPES = ['circle','square','triangle','diamond'] as const;
export const STYLES = ['attacker','defender','allrounder','spinner'] as const;
```
- [ ] **Step 3 (commit):** `git commit -am "feat: memphis design tokens + config"`

---

## Phase 1 — Data layer

### Task 1.1: Supabase міграція `tt_*`
**Files:** Create `supabase/migrations/2026-06-27_tt_init.sql`

- [ ] **Step 1:** Написати SQL (виконується у Supabase SQL Editor):
```sql
create table if not exists public.tt_tournament (
  id text primary key,
  name text, status text not null default 'registration'
    check (status in ('registration','swiss','playoff','done')),
  current_round int not null default 0,
  total_rounds int not null default 8,
  reg_deadline timestamptz,
  champion_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.tt_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text not null unique,
  hero jsonb not null default '{}'::jsonb,
  motto text,
  seed int not null default 0,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.tt_matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('swiss','playoff')),
  round text not null,
  slot int not null default 0,
  a uuid not null references public.tt_players(id) on delete cascade,
  b uuid references public.tt_players(id) on delete cascade,
  seed_a int, seed_b int,
  sets jsonb not null default '[]'::jsonb,
  winner uuid,
  status text not null default 'pending' check (status in ('pending','reported')),
  created_at timestamptz not null default now()
);
create index if not exists tt_matches_stage_round_idx on public.tt_matches (stage, round);
create index if not exists tt_matches_status_idx on public.tt_matches (status);
insert into public.tt_tournament (id,name,status,total_rounds)
  values ('main','КУБОК','registration',8) on conflict (id) do nothing;
alter table public.tt_tournament enable row level security;
alter table public.tt_players enable row level security;
alter table public.tt_matches enable row level security;
-- no policies = no anon access; server secret key bypasses RLS (mirrors First Wind)
```
- [ ] **Step 2:** Виконати в Supabase (SQL Editor → Run) ИЛИ `supabase db push` якщо CLI залінкований. Перевірити: таблиці `tt_*` зʼявились, рядок `main` є.
- [ ] **Step 3 (commit):** `git commit -am "feat: tt_* supabase schema"`

### Task 1.2: Серверний Supabase-клієнт
**Files:** Create `src/lib/supabase/server.ts`

- [ ] **Step 1:** (дзеркало `../ODESA FEST/src/lib/supabase/server.ts`):
```ts
import { createClient } from '@supabase/supabase-js';
export function supaServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } }
  );
}
```
- [ ] **Step 2 (commit):** `git commit -am "feat: supabase server client"`

### Task 1.3: TS-типи
**Files:** Create `src/lib/tournament/types.ts`
```ts
export type Hero = { color: string; shape: string; emblem: string; style: string; theme?: string };
export type Player = { id: string; name: string; nickname: string; hero: Hero; motto?: string; seed: number };
export type SetScore = [number, number];
export type Match = { id: string; stage: 'swiss'|'playoff'; round: string; slot: number;
  a: string; b: string|null; seed_a?: number|null; seed_b?: number|null;
  sets: SetScore[]; winner: string|null; status: 'pending'|'reported' };
export type Tournament = { id: string; name: string; status: 'registration'|'swiss'|'playoff'|'done';
  current_round: number; total_rounds: number; reg_deadline?: string; champion_id?: string|null };
```
- [ ] **Commit:** `git commit -am "feat: tournament types"`

---

## Phase 2 — Tournament logic (TDD, vitest)

> Логіка ідентична перевіреній (best-of-5, swiss greedy, Buchholz, top-8 seed). Кожен модуль: спершу тест → fail → реалізація → pass → commit.

### Task 2.1: scoring.ts
**Files:** Create `src/lib/tournament/scoring.ts`, `scoring.test.ts`

- [ ] **Step 1 (failing test):**
```ts
import { describe, it, expect } from 'vitest';
import { gamesFromSets, winnerFromSets, setsValid } from './scoring';
describe('scoring', () => {
  it('counts games', () => expect(gamesFromSets([[11,7],[9,11],[11,5],[11,8]])).toEqual([3,1]));
  it('winner = side with 3 games', () => expect(winnerFromSets('A','B',[[11,7],[11,9],[11,5]])).toBe('A'));
  it('invalid until someone reaches 3', () => expect(setsValid([[11,7],[9,11]])).toBe(false));
  it('valid at 3-1', () => expect(setsValid([[11,7],[9,11],[11,5],[11,8]])).toBe(true));
});
```
- [ ] **Step 2:** `npx vitest run src/lib/tournament/scoring.test.ts` → FAIL.
- [ ] **Step 3 (impl):**
```ts
import type { SetScore } from './types';
export const GAMES_TO_WIN = 3;
export function gamesFromSets(sets: SetScore[]): [number, number] {
  let a=0,b=0; for (const [x,y] of sets){ if(x>y)a++; else if(y>x)b++; } return [a,b];
}
export function winnerFromSets(aId:string,bId:string,sets:SetScore[]): string|null {
  const [a,b]=gamesFromSets(sets);
  if(a>=GAMES_TO_WIN&&a>b)return aId; if(b>=GAMES_TO_WIN&&b>a)return bId; return null;
}
export function setsValid(sets:SetScore[]): boolean {
  const [a,b]=gamesFromSets(sets);
  return (a===GAMES_TO_WIN&&b<GAMES_TO_WIN)||(b===GAMES_TO_WIN&&a<GAMES_TO_WIN);
}
```
- [ ] **Step 4:** vitest → PASS. **Step 5 commit:** `git commit -am "feat: scoring logic"`

### Task 2.2: standings.ts (очки + Buchholz)
**Files:** Create `standings.ts`, `standings.test.ts`
- [ ] **Step 1 (test):** 4 гравці, кілька reported swiss-матчів → перевірити сортування (очки → Buchholz → GD), поля wins/losses/gw/gl.
- [ ] **Step 2:** fail. **Step 3 (impl):** `computeStandings(players, matches)` → масив `{id,player,points,wins,losses,gw,gl,gd,buchholz,opponents}` відсортований; Buchholz = сума очок суперників. (Портувати з перевіреної версії.) **Step 4:** pass. **Step 5 commit.**

### Task 2.3: swiss.ts (пари + bye + dead-end)
**Files:** Create `swiss.ts`, `swiss.test.ts`
- [ ] **Step 1 (tests):**
  - 16 гравців, тур 1 → 8 пар, усі різні.
  - Немає повтору суперника між турами (прогнати 2 тури, перевірити унікальність пар).
  - Непарна к-сть (15) → рівно 1 bye; bye дістається гравцю з найнижчим standing без попереднього bye; bye-матч status `reported`, winner = той гравець.
  - Dead-end fallback: штучний кейс, де лишилась пара, що вже грала → повтор дозволено (не кидає).
- [ ] **Step 2:** fail. **Step 3 (impl):** `generateSwissRound(players, matches, roundNo)`:
  - порядок: roundNo===1 → за seed; інакше → за computeStandings.
  - greedy: для кожного вільного беремо найближчого вільного, з ким ще не грали; якщо нема — fallback на будь-якого вільного (повтор).
  - bye: якщо лишився один — обрати того, хто ще не мав bye і найнижче в standing; повернути auto-win match.
  - повертає масив match-обʼєктів `{stage:'swiss',round:String(roundNo),slot,a,b,sets,winner,status}`.
- [ ] **Step 4:** pass. **Step 5 commit.**

### Task 2.4: playoff.ts (seed + advance + champion)
**Files:** Create `playoff.ts`, `playoff.test.ts`
- [ ] **Step 1 (tests):**
  - `seedPlayoff` → 4 QF за посівом `1-8,4-5,2-7,3-6` з правильними seed_a/seed_b.
  - `advancePlayoff` після повного QF → 2 SF з переможців; після SF → F (переможці) + BR (переможені); після F → `[]`.
  - `champion(matches)` повертає winner фіналу; `bronze(matches)` повертає winner BR.
- [ ] **Step 2:** fail. **Step 3 (impl):** портувати перевірену логіку (SEED_PAIRS, advance по раундах QF→SF→{F,BR}) + `champion` + `bronze`. **Step 4:** pass. **Step 5 commit.**

---

## Phase 3 — API route handlers

### Task 3.1: `/api/state` (публічний снапшот)
**Files:** Create `src/app/api/state/route.ts`
- [ ] **Step 1 (impl):** GET → `supaServer()` читає tournament(`main`), players (БЕЗ `token`), matches; повертає `{tournament, players, matches}` JSON. `export const dynamic='force-dynamic'`.
- [ ] **Step 2:** Запустити `npm run dev`, `curl localhost:3000/api/state` → JSON із порожніми players/matches + tournament main. **Step 3 commit.**

### Task 3.2: `/api/register`
**Files:** Create `src/app/api/register/route.ts`
- [ ] **Step 1 (impl):** POST `{name,nickname,hero,motto}`. Валідація (zod або вручну): непорожнє ім'я/нік. Перевірити status==='registration' і дедлайн. Insert у `tt_players` (seed = epoch ms або count*137). На unique-violation ніка → 409 `{error:'nick_taken'}`. Повернути `{id, token}`.
- [ ] **Step 2:** curl POST → отримати token; повторний той самий нік → 409. **Step 3 commit.**

### Task 3.3: `/api/report-score`
**Files:** Create `src/app/api/report-score/route.ts`
- [ ] **Step 1 (impl):** POST `{token, matchId, sets}`. Завантажити матч + перевірити: гравець з цим token є a або b матчу; матч `pending`; `setsValid(sets)`. Обчислити winner; update `tt_matches` (sets,winner,status='reported'). Інакше 4xx з причиною.
- [ ] **Step 2:** інтеграційний прогін (див. Task 8). **Step 3 commit.**

### Task 3.4: `/api/admin/[action]`
**Files:** Create `src/app/api/admin/[action]/route.ts`
- [ ] **Step 1 (impl):** POST з `{code}`; якщо `code!==process.env.ADMIN_CODE` → 401. `action`:
  - `start`: status→swiss, current_round→1, createMatches(generateSwissRound(players,[],1)).
  - `next-round`: перевірити, що всі матчі current_round reported; createMatches(generateSwissRound(...,current_round+1)); current_round++.
  - `to-playoff`: перевірити останній тур повний; createMatches(seedPlayoff(players,matches)); status→playoff.
  - `advance`: якщо champion є → status→done + champion_id; інакше createMatches(advancePlayoff(matches)).
  - `reset`: видалити всі `tt_matches`; tournament → status `registration`, current_round 0, champion_id null. (Гравців лишаємо; для повного скиду — окремо очистити `tt_players`.)
  - усі читають свіжий стан із Supabase перед дією.
  - **action list:** `start | next-round | to-playoff | advance | reset`.
- [ ] **Step 2:** curl кожну дію з кодом. **Step 3 commit.**

### Task 3.5: клієнтські хелпери `src/lib/api.ts`
- [ ] fetch-обгортки: `getState()`, `register(payload)`, `reportScore(token,matchId,sets)`, `admin(action,code)`. **Commit.**

---

## Phase 4 — Chrome / shared UI

### Task 4.1: layout.tsx + шрифти + chrome-маунти
**Files:** Create `src/app/layout.tsx`, `src/components/chrome/*`
- [ ] CustomCursor (dot+ring, mix-blend, ховається на touch), Preloader (bouncing shapes, прибирається після load), ScrollProgress (rainbow), DarkToggle (`data-theme` на html + localStorage), Nav (logo з «оком», bordered pill links, стан-залежні пункти), Footer. Усе «use client» де треба. `prefers-reduced-motion` гасить курсор/анімації. **Commit після кожного компонента.**

### Task 4.2: ui-примітиви
**Files:** `src/components/ui/*`
- [ ] Btn, Card, Eyebrow, Shape (memphis-фігури), Countdown (до REG_DEADLINE), Toast, Modal. **Commit.**

### Task 4.3: HeroCard.tsx
**Files:** `src/components/HeroCard.tsx`
- [ ] Memphis-картка з hero json (color/shape/emblem/style/motto) — flip, hard-shadow, акцент-колір. Використовується у білдері, ростері, /me, матчах. **Commit.**

---

## Phase 5 — Landing (інтерактивний, насичений)

### Task 5.1: Hero + LiveStats
- [ ] `landing/Hero.tsx` (великий Unbounded, плаваючі фігури, стан-залежний CTA), `landing/LiveStats.tsx` (учасники/countdown/статус з `/api/state`). **Commit.**

### Task 5.2: FormatExplainer (інтерактив #2)
- [ ] `landing/FormatExplainer.tsx`: клікабельні кроки Реєстрація→Швейцарка→Плей-офф; кожен крок анімує мінідемо (як зводяться пари; як рахуються очки; як виглядає сітка). Керування кліком; reduced-motion → статичні діаграми. **Commit.**

### Task 5.3: HeroBuilder (інтерактив #1)
- [ ] `builder/HeroBuilder.tsx`: контролери (колір з PALETTE, форма з SHAPES, емблема, стиль з STYLES, нік, ім'я, девіз) → live HeroCard. Кнопка «Грати цим героєм» → `register()` → зберегти token у localStorage → редірект `/me/{token}` + конфетті. Помилки (нік зайнятий/після дедлайну) → Toast. **Commit.**

### Task 5.4: Rules + Champions + Faq + Cta
- [ ] `landing/Rules.tsx`, `landing/Champions.tsx` (плейсхолдер-зала слави), `landing/Faq.tsx` (акордеон), `landing/Cta.tsx`. Зібрати все у `app/page.tsx` (server component тягне `/api/state` для початкового стану; інтерактивні діти — client). **Commit.**

---

## Phase 6 — App views

### Task 6.1: /players (ростер)
- [ ] grid HeroCard з `/api/state`. **Commit.**
### Task 6.2: /me/[token]
- [ ] Картка + мої матчі (MatchCard) + ScoreModal (best-of-5 інпути по сетах → `reportScore`). Лише свої матчі редаговані. **Commit.**
### Task 6.3: /schedule
- [ ] Пари поточного туру (MatchCard), мій матч підсвічено, «зіграно X/Y». **Commit.**
### Task 6.4: /standings
- [ ] StandingsTable (поз., гравець, W–L, GD, BCH, PTS), зелена зона топ-8. **Commit.**
### Task 6.5: /bracket
- [ ] Bracket (QF/SF/F/BR колонки), просування переможців, банер чемпіона + конфетті, **бейдж бронзи** (winner BR, зі spec §10). **Commit.**
### Task 6.6: /admin
- [ ] Код-форма → стан-залежні кнопки (start/next-round/to-playoff/advance) із прогресом + danger (reset). **Commit.**

---

## Phase 7 — Polish + deploy

### Task 7.1: Адаптив + reduced-motion + dark-mode прохід
- [ ] Перевірити 0px горизонт. переповнення на 375/desktop усіх сторінок; reduced-motion гасить рух; dark-mode читабельний. **Commit.**
### Task 7.2: Локальна верифікація потоку
- [ ] `npm run test` (усі vitest зелені). Прогнати в браузері: seed демо → start → repor усіх матчів → next-round ×… → to-playoff → advance → champion. Скріни ключових екранів.
### Task 7.3: Deploy (окремий Vercel-проєкт)
- [ ] `npm run build` локально (без помилок). З `tt-cup/`: `npx vercel deploy --prod --yes` (створює окремий проєкт). Додати env у Vercel (`vercel env add` або дашборд): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_CODE`. Перевірити прод-URL: лендинг + `/api/state` 200. **Commit + tag.**

---

## Integration test (Task 8, після Phase 3)
- [ ] vitest або скрипт: register×16 → admin start → report усіх 8 матчів туру (валідні сети) → next-round → … ×8 → to-playoff → report QF/SF/F/BR → advance → `champion` ≠ null. Перевіряє наскрізну логіку + API.
- [ ] **Ізоляція:** тест б'є по СПІЛЬНІЙ Supabase (`tt_*`) — наприкінці зробити cleanup (видалити створені тестові гравців/матчі) або ганяти проти окремого `tournament.id='test'`. Не лишати сміття у проді.

## Definition of Done
- Усі vitest зелені; наскрізний потік працює (реєстрація → 8 турів → топ-8 → чемпіон).
- Стиль = Memphis super-vision (cream/ink + accents, Unbounded+Onest, 3px+hard-shadow, cursor/preloader/progress/dark).
- Лендинг насичений + 3 інтерактиви (hero-builder, format-explainer, live-stats).
- Дані у `tt_*` (не зачіпають фест); записи лише через сервер; токен-ідентифікація.
- Задеплоєно окремим Vercel-проєктом; env виставлені.

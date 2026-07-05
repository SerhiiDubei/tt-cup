# Настільний теніс — турнір (Swiss + top-8 playoff) · Design Spec

**Date:** 2026-06-27
**Status:** Approved for planning
**Author:** brainstorm session (Serhii + Claude)
**Working brand:** placeholder — назва бренду = ОДНА конфігурована константа (`BRAND` у config), щоб
заміна була тривіальною. Не «вигаданий мною» персонаж; клієнт ставить свою назву.

---

## 1. Goal
Сайт турніру з **настільного тенісу**: відвідувач реєструється через інтерактивний
**конструктор-героя**, отримує круту картку гравця, грає **швейцарку у 8 турів** (авто-пари),
сам вписує конкретний рахунок по сетах, бачить **турнірну таблицю**, а топ-8 виходять у
**офлайн плей-офф** (1/4 → 1/2 → фінал + матч за 3-тє) з анімованою сіткою та чемпіоном.

Лендинг має бути **насиченим контентом і інтерактивним** у дизайн-мові проєкту **super-vision**
(Memphis). Не «на відчепись».

## 2. Style (обовʼязково — мова super-vision / Memphis)
- Палітра: cream `#FBF1DD`, ink `#16110D` + яскраві акценти pink `#FF2E88`, cyan `#00CFC1`,
  yellow `#FFC619`, blue `#2D4BFF`, coral `#FF5A36`, purple `#8A45FF`, lime `#A6E22E`.
  Dark-mode варіант (bg `#1B1430`, paper `#251C42`).
- Шрифти: **Unbounded** (display) + **Onest** (body).
- Memphis-примітиви: 3px бордери `var(--line)`, hard-тіні `6px 6px 0` / `10px 10px 0`,
  radius 16–22px, dotted page-texture, геом-фігури.
- Фішки super-vision, які переносимо: **кастом-курсор** (dot+ring, mix-blend), **preloader**
  з bouncing-фігурами, **scroll-progress** (rainbow), **dark-mode toggle**, eyebrow-пігулки,
  reveal-анімації, грайливі hover (translate + shadow).
- `prefers-reduced-motion` гасить рух. Адаптив (mobile-first, 0px горизонт. переповнення).

## 3. Scope

### In scope (MVP)
- Memphis-лендинг з усіма секціями (§7) + 3 інтерактиви (§8).
- Реєстрація через hero-білдер → запис гравця у Supabase, видача приватного токен-лінка.
- Швейцарка 8 турів: серверна генерація пар (рейтинг + без повторів), bye для непарних.
- Вписування рахунку (best-of-5, по сетах) самим гравцем за його токеном.
- Турнірна таблиця: очки → Buchholz → різниця сетів; зелена зона топ-8.
- Топ-8 плей-офф: посів 1-8, 1/4 → 1/2 → фінал + матч за 3-тє; анімована сітка; чемпіон + конфетті.
- Адмін (код у env): закрити реєстрацію/старт, наступний тур, сформувати плей-офф, наступна
  стадія, зафіксувати чемпіона, reset.
- Жива статистика: лічильник учасників, countdown до дедлайну, прогрес турів.
- Деплой окремим Vercel-проєктом.

### Out of scope (поки)
- Платежі (турнір безкоштовний; на відміну від First Wind).
- Email/Telegram-розсилки (можна додати пізніше через Resend, який уже є в екосистемі).
- Мультимова (тільки UA).
- Реальні фото/медіа — плейсхолдери де треба.
- Повноцінна Supabase Auth (використовуємо токен-лінк, див. §6).

## 4. Tech stack
- **Next.js (App Router) + TypeScript** — лендинг + серверні route handlers (secret key, пари,
  адмін-логіка ніколи не в браузері). Дзеркалить архітектуру First Wind.
- **Tailwind CSS** + один шар Memphis-токенів (CSS variables, перенесені з super-vision).
- **Supabase (Postgres)** — той самий проєкт `nitlmgcxdcwtbzfwlhug`. Дані відділені префіксом
  `tt_` (не чіпає `orders`/`participants` фесту). Схема — SQL-міграція.
- **Vercel** — окремий проєкт (separate), не зачіпає super-vision/first-wind деплої.
- Тести: **vitest** (як у First Wind) — чисті функції швейцарки/посіву/скорингу.

## 5. Architecture
```
Browser (Memphis landing + app views)
   │  fetch
   ▼
Next.js route handlers (server, secret key → bypass RLS)
   ├── POST /api/register              → insert tt_players → return {token}
   ├── POST /api/report-score          → validate token owns match → write sets/winner
   ├── GET  /api/state                 → tournament + players + matches (public read snapshot)
   ├── POST /api/admin/start           → close reg → generate swiss round 1
   ├── POST /api/admin/next-round      → if round complete → next swiss round
   ├── POST /api/admin/to-playoff      → seed top-8 → QF
   ├── POST /api/admin/advance         → advance playoff stage / set champion
   └── (admin guarded by ADMIN_CODE env)
   │
   └── Supabase (tt_tournament, tt_players, tt_matches)
```
- Public reads: ТІЛЬКИ через сервер-снапшот `/api/state` (ховає токени інших гравців; без anon-select
  → не потрібні RLS read-policies). Прямий anon-select як альтернатива — відхилено.
- Клієнт тримає свій `player_token` у localStorage (отриманий при реєстрації) — для `/me` і репорту.

## 6. Identity & security (варіант A — токен-лінк)
- Реєстрація створює гравця + `token uuid`. Браузер зберігає token; сторінка `/me/{token}`
  показує картку та матчі гравця, дозволяє вписати рахунок ЛИШЕ у його матчах.
- `/api/report-score` перевіряє, що token належить одному з гравців матчу і матч ще не зіграно.
- Адмін: `ADMIN_CODE` у env; адмін-роути перевіряють заголовок/боді з кодом. Жодної адмін-дії з браузера без коду.
- **RLS ON** на всіх `tt_*`. Публічно: read-only через сервер; усі мутації — серверні з secret key.
- Токени інших гравців ніколи не віддаються клієнту (в `/api/state` віддаємо публічні поля без token).

## 7. Landing sections (Memphis, насичено)
1. **Hero** — великий Unbounded-заголовок, kicker із live-dot, CTA (стан-залежний: Зареєструватися
   / Моя картка / Мій матч / Плей-офф), плаваючі геом-фігури.
2. **Live stats** — лічильник учасників, countdown до дедлайну, статус турніру, прогрес туру.
3. **Інтерактивний пояснювач формату** — клікабельні кроки (Реєстрація → Швейцарка 8 турів →
   Топ-8 плей-офф) з анімованою демонстрацією: як зводяться пари, як рахуються очки, як виглядає сітка.
4. **Hero-білдер гравця** — конфігуратор: колір/форма ракетки, емблема, стиль гри, девіз →
   жива Memphis-картка (flip) → «Грати цим героєм» = реєстрація (запис у Supabase).
5. **Що ти отримуєш / правила** — формат, best-of-5, тайбрейки, офлайн-фінал.
6. **Чемпіони / teaser** (плейсхолдер «зала слави» або минулі переможці).
7. **FAQ** — акордеон.
8. **CTA + футер** — повторний заклик, контакти/соцмережі (плейсхолдери), dark-mode toggle.

## 8. Three interactive features (підтверджені)
- **Hero-builder** (§7.4): стейт конфігуратора → live SVG/CSS картка; submit створює гравця.
- **Format explainer** (§7.3): інтерактивна анімація швейцарки + плей-офф (керована кліком/скролом).
- **Live stats/counter** (§7.2): учасники, дедлайн-countdown, прогрес — з Supabase через `/api/state`.

## 9. App views
- `/players` — ростер (Memphis-картки гравців).
- `/me/{token}` — моя картка + мої матчі + вписування рахунку.
- `/schedule` — пари поточного туру (мій матч підсвічено), статус «зіграно X/Y».
- `/standings` — таблиця (поз., гравець, W–L, GD, Buchholz, PTS), зелена зона топ-8.
- `/bracket` — топ-8 плей-офф, анімоване просування, банер чемпіона.
- `/admin` — код-gated керування турніром.

## 10. Tournament logic (чисті функції, vitest)
- **Матч:** best-of-5, перший до 3 геймів; рахунок по сетах `[[11,7],[9,11],...]`; winner з сетів.
- **Швейцарка:** тур 1 — посів за seed; далі — за поточними очками; пара з найближчим за очками,
  без повтору суперника (greedy). Крайні випадки (зафіксувати у коді + тести):
  - **Bye (непарна к-сть):** отримує гравець із НАЙНИЖЧИМ standing, який ще НЕ мав bye; bye = авто-перемога (3:0).
  - **Greedy dead-end:** якщо для останньої пари лишились лише ті, хто вже грали між собою — дозволяємо
    повтор як fallback (краще повтор, ніж нема туру), логуємо.
- **Standings:** win=1 очко; тайбрейки очки → Buchholz (сума очок суперників) → різниця сетів → імʼя.
- **Плей-офф:** топ-8 за standings; посів `1-8,4-5,2-7,3-6` → QF → SF → (F + BR).
  - **F** = двоє переможців SF; **BR (матч за 3-тє)** = двоє ПЕРЕМОЖЕНИХ SF.
  - чемпіон = переможець F; бронза = переможець BR. `/bracket` та `/api/admin/advance` враховують BR разом з F.

## 11. Data model (`tt_*`, Supabase)
**tt_tournament** (один рядок `id='main'`): name, status (`registration|swiss|playoff|done`),
current_round int, total_rounds int default 8, reg_deadline timestamptz, champion_id, created_at.

**tt_players**: id uuid, name, nickname **(UNIQUE — enforces §12 dup-nick rule)**, hero jsonb
(color, shape, emblem, style, theme), motto, seed int, token uuid (unique, секрет), created_at.

**tt_matches**: id uuid, stage (`swiss|playoff`), round text (`1..8` | `QF|SF|F|BR`), slot int,
a uuid, b uuid null (bye), seed_a int null, seed_b int null, sets jsonb default `[]`,
winner uuid null, status (`pending|reported`), created_at.

RLS ON; індекси на (status), (stage,round). Сервер пише secret key.

## 12. Error handling
- Реєстрація після дедлайну/закриття → блок із поясненням, без insert.
- Дубль ніка → відмова з повідомленням.
- Репорт чужого матчу/без токена/вже зіграного → відмова.
- Невалідний рахунок (ніхто не виграв 3 сети) → відмова з підказкою.
- Адмін-дія без коду → 401.
- Генерація туру поки не всі рахунки внесені → блок із підказкою.

## 13. Testing
- Unit (vitest): scoring (winner/valid), швейцарка (без повторів, bye), standings+Buchholz,
  посів плей-офф, advance.
- Integration: register → start → report усіх матчів туру → next-round → … → to-playoff → advance → champion.
- Manual: повний прогін у браузері + адаптив 375/desktop + dark-mode + reduced-motion.

## 14. Decisions log
- Стиль = **super-vision (Memphis)**, не пиксель і не вигаданий бренд. (Промах попередньої ітерації виправлено.)
- Стек = **Next.js + TS + Tailwind + Supabase**, дзеркало First Wind.
- Supabase **спільна, дані відділені** префіксом `tt_` (варіант A). Окрема схема — відхилено як зайве.
- Ідентифікація = **токен-лінк** (варіант A), без повного Auth.
- Пари/тури/посів — **на сервері** (варіант A), RLS-safe.
- Окремий **Vercel-проєкт** (separate), без впливу на super-vision/first-wind.

## 15. Future (не зараз)
- Email/Telegram-сповіщення (Resend), нагадування про матч.
- Реальна «зала слави», історія турнірів, профілі з історією матчів.
- Повний Auth, ролі суддів, експорт результатів.
- Реальний дедлайн-тригер авто-старту туру.

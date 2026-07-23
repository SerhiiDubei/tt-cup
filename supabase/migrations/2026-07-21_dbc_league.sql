-- Ліга DRUID BATTLE CUP: окремий список реєстрацій для флоу /join.
-- Старий кубок (tt_players) не чіпаємо — ліга живе власною таблицею.
-- pay_code (DBC-XX) НЕ зберігаємо: він детермінований від num, рахується в коді.
create table if not exists public.dbc_players (
  id uuid primary key default gen_random_uuid(),
  num bigint generated always as identity,          -- порядковий номер → код DBC-XX
  token uuid not null unique default gen_random_uuid(),
  kind text not null default 'player' check (kind in ('player', 'volunteer')),
  first_name text not null,
  last_name text not null,
  nick text,                                        -- у чистих волонтерів ніка нема
  telegram text not null,
  level int not null default 1 check (level between 1 and 4),
  level_answers jsonb not null default '[]'::jsonb, -- сирі відповіді на 3 питання
  is_sportik boolean not null default false,
  volunteer boolean not null default false,
  volunteer_roles text[] not null default '{}',
  pay_amount int not null default 420 check (pay_amount in (0, 420, 840)),  -- 0 = волонтер
  paid boolean not null default false,
  paid_claimed_at timestamptz,                      -- гравець натиснув «Я оплатив»
  auth_user_id uuid unique,                         -- звʼязка з Supabase Auth (Google, D-036/D-038)
  created_at timestamptz not null default now()
);
create unique index if not exists dbc_players_nick_idx
  on public.dbc_players (lower(nick)) where nick is not null;
alter table public.dbc_players enable row level security;
-- жодних policies: доступ лише секретним ключем сервера (як tt_*)

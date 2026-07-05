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

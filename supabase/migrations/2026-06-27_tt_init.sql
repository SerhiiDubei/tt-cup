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

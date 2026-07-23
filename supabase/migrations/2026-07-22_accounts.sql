-- АКАУНТИ СЕРВІСУ (D-043): людина в TT Cup ≠ заявка на турнір.
-- accounts — профіль людини (Google-звʼязка, фото, нік, телеграм);
-- dbc_players — заявка на конкретний турнір, лінкується через account_id.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                -- Supabase Auth (Google)
  display_name text,
  nick text,
  photo_url text,
  telegram text,
  created_at timestamptz not null default now()
);
alter table public.accounts enable row level security;
-- політик нема навмисно: доступ лише через secret key з API сервісу

alter table public.dbc_players
  add column if not exists account_id uuid references public.accounts(id);

-- Наявні заявки з Google-привʼязкою отримують акаунти автоматично
insert into public.accounts (auth_user_id, display_name, nick, telegram)
select p.auth_user_id, p.first_name || ' ' || p.last_name, p.nick, p.telegram
from public.dbc_players p
where p.auth_user_id is not null
on conflict (auth_user_id) do nothing;

update public.dbc_players p
set account_id = a.id
from public.accounts a
where p.auth_user_id is not null
  and a.auth_user_id = p.auth_user_id
  and p.account_id is null;

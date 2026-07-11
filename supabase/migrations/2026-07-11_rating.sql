-- Elo-рейтинг «з чистого листа»: стартові 1000 у всіх, дельти пишуться у гру
alter table public.tt_players add column if not exists rating int not null default 1000;
alter table public.tt_casual_games
  add column if not exists delta_a int,
  add column if not exists delta_b int;
-- у старих ігор delta_a/delta_b лишаються NULL — вони не впливали на рейтинг

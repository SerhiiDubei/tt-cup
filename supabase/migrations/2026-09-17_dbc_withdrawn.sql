-- Зняття гравця з турніру: прапорець, а не видалення рядка.
-- Історія оплати (pay_order_ref, pay_status, pay_paid_at) лишається — вона
-- потрібна для повернення через WayForPay і для звірки (INCIDENTS: не
-- переписуємо історію платежів заднім числом). Публічний склад
-- (/api/players, /api/liga-players) тих, хто знявся, не показує і місце
-- в 32 звільняє. Повернення грошей — окрема дія (WayForPay REFUND), після
-- якої колбек сам знімає «оплачено».
alter table public.dbc_players
  add column if not exists withdrawn_at timestamptz;

comment on column public.dbc_players.withdrawn_at is
  'Коли гравець знявся з турніру; null = у грі. Внесок повертається окремо (WayForPay REFUND).';

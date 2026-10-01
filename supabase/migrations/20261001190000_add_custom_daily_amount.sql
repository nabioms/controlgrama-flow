-- ControlGrama: permite definir um valor específico para uma diária sem alterar a diária padrão do trabalhador.
alter table public.attendance
  add column if not exists daily_amount numeric(12,2) null;

create index if not exists attendance_worker_daily_amount_idx
  on public.attendance(worker_id, date)
  where daily_amount is not null;

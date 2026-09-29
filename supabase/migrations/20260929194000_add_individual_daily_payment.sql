-- ControleGrama: permite dar baixa em uma diária trabalhada individualmente,
-- por exemplo quando o diarista recebe antecipadamente no próprio dia.
alter table public.attendance
  add column if not exists paid_at date null,
  add column if not exists payment_method public.payment_method null;

create index if not exists attendance_worker_paid_idx
  on public.attendance(worker_id, paid_at)
  where paid_at is not null;

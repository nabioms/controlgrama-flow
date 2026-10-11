-- ControlGrama: histórico persistente de vales/adiantamentos por diarista.
create table if not exists public.worker_advances (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('pix','dinheiro','transferencia')),
  notes text,
  deducted_amount numeric(12,2) not null default 0 check (deducted_amount >= 0 and deducted_amount <= amount),
  status text not null default 'pendente' check (status in ('pendente','parcial','descontado')),
  last_payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists advance_amount numeric(12,2) not null default 0 check (advance_amount >= 0);

create index if not exists worker_advances_worker_date_idx
  on public.worker_advances(worker_id, date, created_at);

alter table public.worker_advances enable row level security;

drop policy if exists "Authenticated users can read worker advances" on public.worker_advances;
create policy "Authenticated users can read worker advances"
  on public.worker_advances for select to authenticated using (true);

drop policy if exists "Authenticated users can insert worker advances" on public.worker_advances;
create policy "Authenticated users can insert worker advances"
  on public.worker_advances for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update worker advances" on public.worker_advances;
create policy "Authenticated users can update worker advances"
  on public.worker_advances for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete worker advances" on public.worker_advances;
create policy "Authenticated users can delete worker advances"
  on public.worker_advances for delete to authenticated using (true);

grant select, insert, update, delete on public.worker_advances to authenticated;

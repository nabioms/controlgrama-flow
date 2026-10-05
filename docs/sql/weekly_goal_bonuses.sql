-- ControlGrama: Bônus de Meta Semanal. Rode este SQL manualmente no seu Supabase (SQL Editor).
-- Tabela nova e independente. Não altera nenhuma tabela existente.
-- Um registro por diarista + semana (unique), criado somente quando o bônus é marcado como PAGO.
-- Bônus pendentes são calculados em tempo real a partir de Metas, O.S. e Ponto.
create table if not exists public.weekly_goal_bonuses (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete restrict,
  team_id uuid null references public.teams(id) on delete set null,
  goal_week_id uuid null references public.production_goal_weeks(id) on delete set null,
  week_number integer not null,
  week_start date not null,
  week_end date not null,
  week_target_m2 numeric(14,2) not null default 0,
  realized_m2 numeric(14,2) not null default 0,
  percent numeric(8,2) not null default 0,
  goal_met boolean not null default false,
  presence_ok boolean not null default false,
  amount numeric(12,2) not null default 100,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  paid_at date null,
  method text null check (method is null or method in ('pix','dinheiro','transferencia')),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_goal_bonuses_worker_week_unique unique (worker_id, week_start)
);

grant select, insert, update, delete on public.weekly_goal_bonuses to authenticated;
grant all on public.weekly_goal_bonuses to service_role;

alter table public.weekly_goal_bonuses enable row level security;

drop policy if exists "Authenticated can read weekly bonuses" on public.weekly_goal_bonuses;
create policy "Authenticated can read weekly bonuses" on public.weekly_goal_bonuses
  for select to authenticated using (true);

drop policy if exists "Admins can manage weekly bonuses" on public.weekly_goal_bonuses;
create policy "Admins can manage weekly bonuses" on public.weekly_goal_bonuses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

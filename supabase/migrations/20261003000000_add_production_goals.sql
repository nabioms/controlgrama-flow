create table if not exists public.production_goals (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^\\d{4}-\\d{2}$'),
  target_m2 numeric(14,2) not null check (target_m2 > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_goal_weeks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.production_goals(id) on delete cascade,
  week_number integer not null check (week_number > 0),
  start_date date not null,
  end_date date not null,
  target_m2 numeric(14,2) not null check (target_m2 >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(goal_id, week_number),
  check(end_date >= start_date)
);

create index if not exists production_goal_weeks_goal_id_idx on public.production_goal_weeks(goal_id);
create index if not exists production_goal_weeks_dates_idx on public.production_goal_weeks(start_date,end_date);

alter table public.production_goals enable row level security;
alter table public.production_goal_weeks enable row level security;

drop policy if exists "Authenticated can read production goals" on public.production_goals;
create policy "Authenticated can read production goals" on public.production_goals
  for select to authenticated using (true);
drop policy if exists "Admins can manage production goals" on public.production_goals;
create policy "Admins can manage production goals" on public.production_goals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated can read production goal weeks" on public.production_goal_weeks;
create policy "Authenticated can read production goal weeks" on public.production_goal_weeks
  for select to authenticated using (true);
drop policy if exists "Admins can manage production goal weeks" on public.production_goal_weeks;
create policy "Admins can manage production goal weeks" on public.production_goal_weeks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.production_goals, public.production_goal_weeks to authenticated;
grant insert, update, delete on public.production_goals, public.production_goal_weeks to authenticated;

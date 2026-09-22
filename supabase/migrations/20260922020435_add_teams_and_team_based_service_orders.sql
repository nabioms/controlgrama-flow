create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  foreman_worker_id uuid null references public.workers(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, worker_id),
  unique (worker_id)
);

create index if not exists team_members_team_id_idx on public.team_members(team_id);
create index if not exists team_members_worker_id_idx on public.team_members(worker_id);
create index if not exists teams_foreman_worker_id_idx on public.teams(foreman_worker_id);

alter table public.service_orders
  add column if not exists team_id uuid null references public.teams(id) on delete set null;

create index if not exists service_orders_team_id_idx on public.service_orders(team_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "Authenticated can read teams" on public.teams;
create policy "Authenticated can read teams" on public.teams
  for select to authenticated using (true);

drop policy if exists "Admins can manage teams" on public.teams;
create policy "Admins can manage teams" on public.teams
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated can read team members" on public.team_members;
create policy "Authenticated can read team members" on public.team_members
  for select to authenticated using (true);

drop policy if exists "Admins can manage team members" on public.team_members;
create policy "Admins can manage team members" on public.team_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated can read service orders" on public.service_orders;
create policy "Authenticated can read service orders" on public.service_orders
  for select to authenticated using (true);

drop policy if exists "Authenticated can insert service orders" on public.service_orders;
create policy "Authenticated can insert service orders" on public.service_orders
  for insert to authenticated with check (true);

drop policy if exists "Authenticated can update service orders" on public.service_orders;
create policy "Authenticated can update service orders" on public.service_orders
  for update to authenticated using (true) with check (true);

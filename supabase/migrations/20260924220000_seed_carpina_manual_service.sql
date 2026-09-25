-- Add the standard Carpina Manual service used in service orders.
insert into public.service_types (name, unit, unit_price, active)
select 'Carpina Manual', 'm2', 0.53, true
where not exists (
  select 1 from public.service_types where lower(name) = lower('Carpina Manual')
);

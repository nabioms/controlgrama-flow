alter table public.receivables
  alter column contract_id drop not null;

drop index if exists public.receivables_service_order_id_uidx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'receivables_service_order_id_key'
      and conrelid = 'public.receivables'::regclass
  ) then
    alter table public.receivables
      add constraint receivables_service_order_id_key unique (service_order_id);
  end if;
end $$;

create or replace function public.finalize_service_order(
  p_service_order_id uuid,
  p_status text,
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.service_orders%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_quantity numeric;
  v_total numeric := 0;
begin
  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then raise exception 'O.S. não encontrada.'; end if;
  if v_order.status <> 'aberta' then raise exception 'Esta O.S. já foi finalizada.'; end if;
  if p_status not in ('realizada', 'nao_realizada') then raise exception 'Status de finalização inválido.'; end if;

  if p_status = 'nao_realizada' then
    update public.service_orders
       set status = 'nao_realizada', realized_quantity = null, realized_amount = 0,
           completed_at = now(), updated_at = now()
     where id = p_service_order_id;
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item->>'item_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity is null or v_quantity < 0 then raise exception 'Há quantidade realizada inválida.'; end if;

    update public.service_order_items
       set realized_quantity = v_quantity,
           realized_amount = round(v_quantity * unit_price, 2),
           updated_at = now()
     where id = v_item_id and service_order_id = p_service_order_id;

    if not found then raise exception 'Item de serviço inválido para esta O.S.'; end if;
  end loop;

  select coalesce(sum(realized_amount), 0) into v_total
  from public.service_order_items where service_order_id = p_service_order_id;

  update public.service_orders
     set status = 'realizada',
         realized_quantity = (select coalesce(sum(realized_quantity), 0) from public.service_order_items where service_order_id = p_service_order_id),
         realized_amount = round(v_total, 2),
         completed_at = now(), updated_at = now()
   where id = p_service_order_id;

  if v_total > 0 then
    insert into public.receivables (
      contract_id, service_order_id, reference_period, expected_amount, expected_date,
      status, received_at, commitment_note
    )
    values (
      v_order.contract_id, v_order.id, 'O.S. #' || v_order.order_number::text,
      round(v_total, 2), v_order.service_date, 'pendente', null, null
    )
    on conflict (service_order_id)
    do update set
      contract_id = excluded.contract_id,
      reference_period = excluded.reference_period,
      expected_amount = excluded.expected_amount,
      expected_date = excluded.expected_date,
      updated_at = now();
  end if;
end;
$$;

grant execute on function public.finalize_service_order(uuid, text, jsonb) to authenticated;

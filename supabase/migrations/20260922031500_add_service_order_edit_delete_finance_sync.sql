-- ControlGrama: editar/apagar O.S. com sincronização financeira

create or replace function public.update_service_order(
  p_service_order_id uuid,
  p_service_date date,
  p_contract_id uuid,
  p_team_id uuid,
  p_notes text,
  p_items jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.service_orders%rowtype;
  v_receivable public.receivables%rowtype;
  v_item jsonb;
  v_type_id uuid;
  v_item_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_planned_total numeric := 0;
  v_realized_total numeric := 0;
  v_realized_quantity numeric := 0;
begin
  select * into v_order from public.service_orders where id = p_service_order_id for update;
  if not found then raise exception 'O.S. não encontrada.'; end if;

  select * into v_receivable from public.receivables where service_order_id = p_service_order_id for update;

  if v_order.status = 'realizada' and v_receivable.status = 'recebido' then
    raise exception 'Esta O.S. já foi recebida no Financeiro e não pode ser editada. Faça um ajuste financeiro separado.';
  end if;

  if not exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.active = true and t.foreman_worker_id is not null
  ) then
    raise exception 'A equipe selecionada precisa estar ativa e ter encarregado.';
  end if;

  if v_order.status = 'realizada' then
    if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
      raise exception 'A O.S. realizada precisa ter os serviços carregados.';
    end if;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
      v_item_id := nullif(v_item->>'item_id','')::uuid;
      v_quantity := (v_item->>'realized_quantity')::numeric;
      if v_item_id is null or v_quantity is null or v_quantity < 0 then
        raise exception 'Há quantidade realizada inválida.';
      end if;

      update public.service_order_items
      set realized_quantity = v_quantity,
          realized_amount = round(v_quantity * unit_price, 2),
          updated_at = now()
      where id = v_item_id and service_order_id = p_service_order_id;

      if not found then raise exception 'Item inválido para esta O.S.'; end if;
    end loop;

    select coalesce(sum(realized_quantity),0), coalesce(sum(realized_amount),0)
      into v_realized_quantity, v_realized_total
    from public.service_order_items
    where service_order_id = p_service_order_id;

    update public.service_orders
    set service_date = p_service_date,
        contract_id = p_contract_id,
        team_id = p_team_id,
        notes = nullif(trim(coalesce(p_notes,'')), ''),
        realized_quantity = v_realized_quantity,
        realized_amount = round(v_realized_total,2),
        updated_at = now()
    where id = p_service_order_id;

    if v_receivable.id is not null then
      update public.receivables
      set contract_id = p_contract_id,
          reference_period = 'O.S. #' || v_order.order_number::text,
          expected_amount = round(v_realized_total,2),
          expected_date = p_service_date,
          updated_at = now()
      where id = v_receivable.id;
    end if;
    return;
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Adicione pelo menos um serviço.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_type_id := nullif(v_item->>'service_type_id','')::uuid;
    v_quantity := (v_item->>'planned_quantity')::numeric;
    if v_type_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Há serviço ou quantidade inválida.';
    end if;

    select unit_price into v_unit_price
    from public.service_types
    where id = v_type_id and active = true;
    if v_unit_price is null then raise exception 'Tipo de serviço inválido ou inativo.'; end if;
    v_planned_total := v_planned_total + round(v_quantity*v_unit_price,2);
  end loop;

  delete from public.service_order_items where service_order_id = p_service_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_type_id := (v_item->>'service_type_id')::uuid;
    v_quantity := (v_item->>'planned_quantity')::numeric;
    select unit_price into v_unit_price from public.service_types where id = v_type_id;
    insert into public.service_order_items(
      service_order_id,service_type_id,planned_quantity,realized_quantity,
      unit_price,planned_amount,realized_amount
    )
    values(
      p_service_order_id,v_type_id,v_quantity,null,v_unit_price,
      round(v_quantity*v_unit_price,2),0
    );
  end loop;

  update public.service_orders
  set service_date = p_service_date,
      contract_id = p_contract_id,
      team_id = p_team_id,
      notes = nullif(trim(coalesce(p_notes,'')), ''),
      service_type_id = (
        select service_type_id from public.service_order_items
        where service_order_id=p_service_order_id order by created_at limit 1
      ),
      planned_quantity = (
        select planned_quantity from public.service_order_items
        where service_order_id=p_service_order_id order by created_at limit 1
      ),
      unit_price = (
        select unit_price from public.service_order_items
        where service_order_id=p_service_order_id order by created_at limit 1
      ),
      planned_amount = round(v_planned_total,2),
      updated_at = now()
  where id = p_service_order_id;
end;
$$;

create or replace function public.delete_service_order(p_service_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.service_orders%rowtype;
  v_receivable public.receivables%rowtype;
begin
  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then raise exception 'O.S. não encontrada.'; end if;

  select * into v_receivable
  from public.receivables
  where service_order_id = p_service_order_id
  for update;

  if v_receivable.status = 'recebido' then
    raise exception 'Esta O.S. já foi recebida no Financeiro e não pode ser apagada.';
  end if;

  if v_receivable.id is not null then
    delete from public.receivables where id = v_receivable.id;
  end if;

  delete from public.service_orders where id = p_service_order_id;
end;
$$;

grant execute on function public.update_service_order(uuid,date,uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.delete_service_order(uuid) to authenticated;
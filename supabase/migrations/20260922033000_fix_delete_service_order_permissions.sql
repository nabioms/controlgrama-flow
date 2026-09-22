create or replace function public.delete_service_order(p_service_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.service_orders%rowtype;
  v_receivable public.receivables%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem apagar uma O.S.';
  end if;

  select * into v_order
  from public.service_orders
  where id = p_service_order_id
  for update;

  if not found then
    raise exception 'O.S. não encontrada.';
  end if;

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

revoke all on function public.delete_service_order(uuid) from public;
grant execute on function public.delete_service_order(uuid) to authenticated;

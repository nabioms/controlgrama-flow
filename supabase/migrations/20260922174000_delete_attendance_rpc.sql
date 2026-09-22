create or replace function public.delete_attendance(p_attendance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.attendance
  where id = p_attendance_id;

  if not found then
    raise exception 'Marcação não encontrada.';
  end if;
end;
$$;

revoke all on function public.delete_attendance(uuid) from public;
grant execute on function public.delete_attendance(uuid) to authenticated;

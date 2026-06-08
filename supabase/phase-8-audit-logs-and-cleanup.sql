begin;

alter table public.audit_logs
  alter column action type text using action::text,
  alter column table_name drop not null,
  add column if not exists user_email text,
  add column if not exists user_role text,
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists target_name text,
  add column if not exists details jsonb,
  add column if not exists is_test_data boolean not null default true;

grant select, insert, delete on table public.audit_logs to authenticated;

drop policy if exists "audit logs select by admin" on public.audit_logs;
drop policy if exists "audit logs insert by signed in role" on public.audit_logs;
drop policy if exists "audit logs delete test data by admin" on public.audit_logs;

create policy "audit logs select by admin"
  on public.audit_logs for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = audit_logs.store_id
      )
    )
  );

create policy "audit logs insert by signed in role"
  on public.audit_logs for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = audit_logs.store_id
      )
    )
  );

create policy "audit logs delete test data by admin"
  on public.audit_logs for delete
  to authenticated
  using (
    auth.uid() is not null
    and is_test_data = true
    and public.current_investor_permission_role() = 'admin'
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = audit_logs.store_id
      )
    )
  );

create or replace function public.clear_development_test_data(
  confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_store_id uuid;
  deleted_incomes integer;
  deleted_expenses integer;
  deleted_dividend_records integer;
  deleted_rooms integer;
  deleted_monthly_rent_records integer;
  deleted_evidence_files integer;
  deleted_audit_logs integer;
begin
  if auth.uid() is null or public.current_investor_permission_role() <> 'admin' then
    raise exception 'Administrator access is required.';
  end if;

  if confirmation_text <> 'CLEAR TEST DATA' then
    raise exception 'Invalid confirmation text.';
  end if;

  target_store_id := public.current_profile_store_id();
  if target_store_id is null then
    select p.store_id into target_store_id
    from public.current_investor_profile() p
    limit 1;
  end if;

  if target_store_id is null then
    raise exception 'The current administrator does not have a store.';
  end if;

  delete from public.audit_logs where store_id = target_store_id and is_test_data = true;
  get diagnostics deleted_audit_logs = row_count;

  delete from public.dividend_records where store_id = target_store_id;
  get diagnostics deleted_dividend_records = row_count;

  delete from public.monthly_rent_records where store_id = target_store_id;
  get diagnostics deleted_monthly_rent_records = row_count;

  delete from public.rooms where store_id = target_store_id;
  get diagnostics deleted_rooms = row_count;

  delete from public.incomes where store_id = target_store_id;
  get diagnostics deleted_incomes = row_count;

  delete from public.expenses where store_id = target_store_id;
  get diagnostics deleted_expenses = row_count;

  delete from public.evidence_files where store_id = target_store_id;
  get diagnostics deleted_evidence_files = row_count;

  return jsonb_build_object(
    'deleted_incomes', deleted_incomes,
    'deleted_expenses', deleted_expenses,
    'deleted_dividend_records', deleted_dividend_records,
    'deleted_rooms', deleted_rooms,
    'deleted_monthly_rent_records', deleted_monthly_rent_records,
    'deleted_evidence_files', deleted_evidence_files,
    'deleted_audit_logs', deleted_audit_logs
  );
end;
$$;

revoke all on function public.clear_development_test_data(text) from public;
grant execute on function public.clear_development_test_data(text) to authenticated;

commit;

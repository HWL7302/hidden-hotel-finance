begin;

alter table public.audit_logs
  alter column action type text using action::text,
  alter column table_name drop not null,
  add column if not exists user_email text,
  add column if not exists user_role text,
  add column if not exists target_type text,
  add column if not exists operation_text text,
  add column if not exists target_id uuid,
  add column if not exists target_name text,
  add column if not exists details jsonb,
  add column if not exists is_test_data boolean not null default true;

update public.audit_logs
set operation_text = coalesce(
  operation_text,
  nullif(target_name, ''),
  nullif(reason, ''),
  trim(concat(action, ' ', coalesce(target_type, table_name, '')))
)
where operation_text is null;

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

create or replace function public.enforce_audit_log_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_store_id uuid;
  retained_start date;
  retained_end date;
  deleted_count integer;
begin
  if auth.uid() is null or public.current_investor_permission_role() <> 'admin' then
    raise exception 'Administrator access is required.';
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

  retained_start := (date_trunc('month', now())::date - interval '12 months')::date;
  retained_end := date_trunc('month', now())::date;

  delete from public.audit_logs
  where store_id = target_store_id
    and created_at < retained_start
    and coalesce(operation_text, '') <> '系统自动清理审计日志';
  get diagnostics deleted_count = row_count;

  if deleted_count > 0 then
    insert into public.audit_logs (
      store_id,
      user_id,
      user_email,
      user_role,
      action,
      target_type,
      operation_text,
      is_test_data
    )
    values (
      target_store_id,
      auth.uid(),
      coalesce(auth.jwt() ->> 'email', 'system'),
      'system',
      'delete',
      'audit_log',
      format(
        '系统自动清理审计日志：删除 %s 条，保留范围 %s ～ %s',
        deleted_count,
        to_char(retained_start, 'YYYY-MM'),
        to_char(retained_end, 'YYYY-MM')
      ),
      false
    );
  end if;

  return jsonb_build_object(
    'deleted_count', deleted_count,
    'retained_start', to_char(retained_start, 'YYYY-MM'),
    'retained_end', to_char(retained_end, 'YYYY-MM')
  );
end;
$$;

revoke all on function public.enforce_audit_log_retention() from public;
grant execute on function public.enforce_audit_log_retention() to authenticated;

commit;

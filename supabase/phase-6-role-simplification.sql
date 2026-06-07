-- Phase 6: simplify RBAC to admin/operator/viewer and fix evidence access.
-- Run this script once in the Supabase SQL Editor.

begin;

update public.investors
set permission_role = 'viewer'
where permission_role = 'manager';

alter table public.investors
  drop constraint if exists investors_permission_role_check;

alter table public.investors
  add constraint investors_permission_role_check
  check (permission_role in ('viewer', 'operator', 'admin'));

create or replace function public.current_investor_permission_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when trim(lower(coalesce(auth.jwt() ->> 'email', ''))) = 'kiu9ninomi@gmail.com'
        then 'admin'
      else coalesce(
        (
          select i.permission_role
          from public.investors i
          where trim(lower(i.email)) = trim(lower(coalesce(auth.jwt() ->> 'email', '')))
            and i.is_active = true
          order by i.created_at desc
          limit 1
        ),
        'viewer'
      )
    end
$$;

revoke all on function public.current_investor_permission_role() from public;
grant execute on function public.current_investor_permission_role() to authenticated;

create or replace function public.current_investor_profile()
returns table (
  id uuid,
  investment_amount numeric,
  share_ratio numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.investment_amount, i.share_ratio
  from public.investors i
  where trim(lower(i.email)) = trim(lower(coalesce(auth.jwt() ->> 'email', '')))
    and i.is_active = true
  order by i.created_at desc
  limit 1
$$;

revoke all on function public.current_investor_profile() from public;
grant execute on function public.current_investor_profile() to authenticated;

create or replace function public.prevent_fixed_admin_investor_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fixed_email constant text := 'kiu9ninomi@gmail.com';
  current_email text := trim(lower(coalesce(auth.jwt() ->> 'email', '')));
begin
  if tg_op = 'DELETE' then
    if trim(lower(old.email)) = fixed_email and current_email <> fixed_email then
      raise exception 'Fixed administrator investor record is protected.';
    end if;

    return old;
  end if;

  if (
    trim(lower(coalesce(old.email, ''))) = fixed_email
    or trim(lower(coalesce(new.email, ''))) = fixed_email
  ) and current_email <> fixed_email then
    raise exception 'Fixed administrator investor record is protected.';
  end if;

  if trim(lower(coalesce(old.email, ''))) = fixed_email then
    new.email := fixed_email;
    new.permission_role := 'admin';
    new.is_active := true;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_fixed_admin_investor_changes on public.investors;
create trigger prevent_fixed_admin_investor_changes
before update or delete on public.investors
for each row execute function public.prevent_fixed_admin_investor_changes();

create or replace function public.prevent_fixed_admin_investment_record_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fixed_email constant text := 'kiu9ninomi@gmail.com';
  current_email text := trim(lower(coalesce(auth.jwt() ->> 'email', '')));
  target_investor_id uuid;
begin
  if tg_op = 'DELETE' then
    target_investor_id := old.investor_id;
  else
    target_investor_id := new.investor_id;
  end if;

  if current_email <> fixed_email and exists (
    select 1
    from public.investors i
    where i.id = target_investor_id
      and trim(lower(i.email)) = fixed_email
  ) then
    raise exception 'Fixed administrator investment records are protected.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_fixed_admin_investment_record_changes on public.investment_records;
create trigger prevent_fixed_admin_investment_record_changes
before insert or update or delete on public.investment_records
for each row execute function public.prevent_fixed_admin_investment_record_changes();

drop policy if exists "evidence select by store role" on public.evidence_files;
drop policy if exists "evidence insert by admin operator" on public.evidence_files;
drop policy if exists "evidence delete by admin operator" on public.evidence_files;
drop policy if exists "evidence delete by admin" on public.evidence_files;

drop policy if exists "dividend records admin all" on public.dividend_records;
drop policy if exists "dividend records investor own select" on public.dividend_records;

create policy "dividend records admin all"
  on public.dividend_records for all
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and public.current_profile_store_id() = store_id
  )
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

create policy "dividend records investor own select"
  on public.dividend_records for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'viewer'
    and public.current_profile_store_id() = store_id
    and exists (
      select 1
      from public.investors i
      where i.id = investor_id
        and trim(lower(i.email)) = trim(lower(coalesce(auth.jwt() ->> 'email', '')))
        and i.store_id = store_id
        and i.is_active = true
    )
  );

create policy "evidence select by store role"
  on public.evidence_files for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and public.current_profile_store_id() = store_id
  );

create policy "evidence insert by admin operator"
  on public.evidence_files for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
    and uploaded_by = auth.uid()
  );

create policy "evidence delete by admin"
  on public.evidence_files for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

drop policy if exists "evidence storage select by store role" on storage.objects;
drop policy if exists "evidence storage insert by admin operator" on storage.objects;
drop policy if exists "evidence storage delete by admin operator" on storage.objects;
drop policy if exists "evidence storage delete by admin" on storage.objects;

create policy "evidence storage select by store role"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

create policy "evidence storage insert by admin operator"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence-files'
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

create policy "evidence storage delete by admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.current_investor_permission_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

commit;

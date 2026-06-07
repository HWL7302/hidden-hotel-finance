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

drop policy if exists "evidence select by store role" on public.evidence_files;
drop policy if exists "evidence insert by admin operator" on public.evidence_files;
drop policy if exists "evidence delete by admin operator" on public.evidence_files;

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

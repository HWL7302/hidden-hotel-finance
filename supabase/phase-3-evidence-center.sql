-- Phase 3: evidence center and development-only cleanup tool.
-- Run this script once in the Supabase SQL Editor.

begin;

insert into storage.buckets (id, name, public)
values ('evidence-files', 'evidence-files', false)
on conflict (id) do update set public = excluded.public;

grant select, insert, delete on table public.evidence_files to authenticated;

drop policy if exists "evidence_files_admin_all" on public.evidence_files;
drop policy if exists "evidence_files_insert_operator_admin" on public.evidence_files;
drop policy if exists "evidence_files_select_allowed" on public.evidence_files;
drop policy if exists "evidence select by store role" on public.evidence_files;
drop policy if exists "evidence insert by admin operator" on public.evidence_files;
drop policy if exists "evidence delete by admin operator" on public.evidence_files;

create policy "evidence select by store role"
  on public.evidence_files for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  );

create policy "evidence insert by admin operator"
  on public.evidence_files for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
    and uploaded_by = auth.uid()
  );

create policy "evidence delete by admin operator"
  on public.evidence_files for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
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
    and public.current_profile_role() in ('admin', 'operator')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

create policy "evidence storage insert by admin operator"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence-files'
    and public.current_profile_role() in ('admin', 'operator')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

create policy "evidence storage delete by admin operator"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.current_profile_role() in ('admin', 'operator')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
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
  deleted_evidence_files integer;
begin
  if auth.uid() is null or public.current_profile_role() <> 'admin' then
    raise exception 'Administrator access is required.';
  end if;

  if confirmation_text <> 'CLEAR TEST DATA' then
    raise exception 'Invalid confirmation text.';
  end if;

  target_store_id := public.current_profile_store_id();
  if target_store_id is null then
    raise exception 'The current administrator does not have a store.';
  end if;

  delete from public.incomes where store_id = target_store_id;
  get diagnostics deleted_incomes = row_count;

  delete from public.expenses where store_id = target_store_id;
  get diagnostics deleted_expenses = row_count;

  delete from public.evidence_files where store_id = target_store_id;
  get diagnostics deleted_evidence_files = row_count;

  return jsonb_build_object(
    'deleted_incomes', deleted_incomes,
    'deleted_expenses', deleted_expenses,
    'deleted_evidence_files', deleted_evidence_files
  );
end;
$$;

revoke all on function public.clear_development_test_data(text) from public;
grant execute on function public.clear_development_test_data(text) to authenticated;

commit;

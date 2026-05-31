-- Reconcile only the Phase 2 income and expense access chain.
-- Run this script in the Supabase SQL Editor after reviewing the project target.

begin;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;

grant usage on schema public to authenticated;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_profile_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_store_id() to authenticated;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.stores from anon, authenticated;
revoke all on table public.incomes from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.stores to authenticated;
grant select, insert, update, delete on table public.incomes to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;

drop policy if exists "profile select own or admin" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_select_allowed" on public.profiles;
drop policy if exists "profile select own" on public.profiles;

drop policy if exists "store select own store" on public.stores;
drop policy if exists "stores_admin_all" on public.stores;
drop policy if exists "stores_select_allowed" on public.stores;
drop policy if exists "store select own" on public.stores;

drop policy if exists "income delete by admin operator" on public.incomes;
drop policy if exists "income insert by admin operator" on public.incomes;
drop policy if exists "income select by store role" on public.incomes;
drop policy if exists "income update by admin operator" on public.incomes;
drop policy if exists "incomes_delete_admin_only" on public.incomes;
drop policy if exists "incomes_insert_operator_admin" on public.incomes;
drop policy if exists "incomes_select_allowed" on public.incomes;
drop policy if exists "incomes_update_operator_admin" on public.incomes;

drop policy if exists "expense delete by admin operator" on public.expenses;
drop policy if exists "expense insert by admin operator" on public.expenses;
drop policy if exists "expense select by store role" on public.expenses;
drop policy if exists "expense update by admin operator" on public.expenses;
drop policy if exists "expenses_delete_admin_only" on public.expenses;
drop policy if exists "expenses_insert_operator_admin" on public.expenses;
drop policy if exists "expenses_select_allowed" on public.expenses;
drop policy if exists "expenses_update_operator_admin" on public.expenses;

create policy "profile select own"
  on public.profiles for select
  to authenticated
  using (auth.uid() is not null and id = auth.uid());

create policy "store select own"
  on public.stores for select
  to authenticated
  using (auth.uid() is not null and id = public.current_profile_store_id());

create policy "income select by store role"
  on public.incomes for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
    and public.current_profile_store_id() = store_id
  );

create policy "income insert by admin operator"
  on public.incomes for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
    and created_by = auth.uid()
  );

create policy "income update by admin operator"
  on public.incomes for update
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  )
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  );

create policy "income delete by admin operator"
  on public.incomes for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  );

create policy "expense select by store role"
  on public.expenses for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
    and public.current_profile_store_id() = store_id
  );

create policy "expense insert by admin operator"
  on public.expenses for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
    and created_by = auth.uid()
  );

create policy "expense update by admin operator"
  on public.expenses for update
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  )
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  );

create policy "expense delete by admin operator"
  on public.expenses for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
  );

commit;

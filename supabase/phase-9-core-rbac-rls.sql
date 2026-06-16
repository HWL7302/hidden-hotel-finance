-- Phase 9: align core finance RLS with investor permission roles.
-- Run this script in the Supabase SQL Editor for the Hidden Hotel project.
--
-- Purpose:
-- - Use auth email -> investors.permission_role for admin/operator/viewer.
-- - Keep kiu9ninomi@gmail.com as the fixed admin regardless of investor data.
-- - Allow admin/operator writes to incomes and expenses.
-- - Allow only admin writes to monthly_closings.
-- - Keep viewer read-only for these finance records.

begin;

alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_closings enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.incomes to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
grant select, insert, update on table public.monthly_closings to authenticated;

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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
$$;

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_investor_permission_role() = 'operator'
$$;

create or replace function public.is_admin_or_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
$$;

create or replace function public.current_user_can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.current_profile_store_id() = target_store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = target_store_id
      )
    )
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_operator() from public;
revoke all on function public.is_admin_or_operator() from public;
revoke all on function public.current_user_can_access_store(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_operator() to authenticated;
grant execute on function public.is_admin_or_operator() to authenticated;
grant execute on function public.current_user_can_access_store(uuid) to authenticated;

drop policy if exists "income select by store role" on public.incomes;
drop policy if exists "income insert by admin operator" on public.incomes;
drop policy if exists "income update by admin operator" on public.incomes;
drop policy if exists "income delete by admin operator" on public.incomes;
drop policy if exists "incomes_select_allowed" on public.incomes;
drop policy if exists "incomes_insert_operator_admin" on public.incomes;
drop policy if exists "incomes_update_operator_admin" on public.incomes;
drop policy if exists "incomes_delete_admin_only" on public.incomes;

create policy "income select by investor permission role"
  on public.incomes for select
  to authenticated
  using (
    public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and public.current_user_can_access_store(store_id)
  );

create policy "income insert by admin operator"
  on public.incomes for insert
  to authenticated
  with check (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
    and created_by = auth.uid()
  );

create policy "income update by admin operator"
  on public.incomes for update
  to authenticated
  using (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
  )
  with check (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
  );

create policy "income delete by admin operator"
  on public.incomes for delete
  to authenticated
  using (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
  );

drop policy if exists "expense select by store role" on public.expenses;
drop policy if exists "expense insert by admin operator" on public.expenses;
drop policy if exists "expense update by admin operator" on public.expenses;
drop policy if exists "expense delete by admin operator" on public.expenses;
drop policy if exists "expenses_select_allowed" on public.expenses;
drop policy if exists "expenses_insert_operator_admin" on public.expenses;
drop policy if exists "expenses_update_operator_admin" on public.expenses;
drop policy if exists "expenses_delete_admin_only" on public.expenses;

create policy "expense select by investor permission role"
  on public.expenses for select
  to authenticated
  using (
    public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and public.current_user_can_access_store(store_id)
  );

create policy "expense insert by admin operator"
  on public.expenses for insert
  to authenticated
  with check (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
    and created_by = auth.uid()
  );

create policy "expense update by admin operator"
  on public.expenses for update
  to authenticated
  using (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
  )
  with check (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
  );

create policy "expense delete by admin operator"
  on public.expenses for delete
  to authenticated
  using (
    public.is_admin_or_operator()
    and public.current_user_can_access_store(store_id)
  );

drop policy if exists "monthly closings select by store role" on public.monthly_closings;
drop policy if exists "monthly closings insert by admin" on public.monthly_closings;
drop policy if exists "monthly closings update by admin" on public.monthly_closings;

create policy "monthly closings select by investor permission role"
  on public.monthly_closings for select
  to authenticated
  using (
    public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and public.current_user_can_access_store(store_id)
  );

create policy "monthly closings insert by admin"
  on public.monthly_closings for insert
  to authenticated
  with check (
    public.is_admin()
    and public.current_user_can_access_store(store_id)
  );

create policy "monthly closings update by admin"
  on public.monthly_closings for update
  to authenticated
  using (
    public.is_admin()
    and public.current_user_can_access_store(store_id)
  )
  with check (
    public.is_admin()
    and public.current_user_can_access_store(store_id)
  );

commit;

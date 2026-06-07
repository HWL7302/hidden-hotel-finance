-- Phase 5: RBAC email based role lookup.
-- Run this script once in the Supabase SQL Editor before testing non-admin roles.

begin;

alter table public.investors
  add column if not exists email text;

alter table public.investors
  add column if not exists contact text;

alter table public.investors
  add column if not exists permission_role text default 'viewer';

update public.investors
set permission_role = 'viewer'
where permission_role is null;

update public.investors
set permission_role = 'viewer'
where permission_role = 'manager';

alter table public.investors
  alter column permission_role set default 'viewer',
  alter column permission_role set not null;

alter table public.investors
  drop constraint if exists investors_permission_role_check;

alter table public.investors
  add constraint investors_permission_role_check
  check (permission_role in ('viewer', 'operator', 'admin'));

create index if not exists investors_email_lower_idx
  on public.investors (lower(email));

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

commit;

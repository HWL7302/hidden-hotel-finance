-- Phase 5: RBAC role values.
-- Run this script once in the Supabase SQL Editor before assigning manager roles.

begin;

alter table public.investors
  drop constraint if exists investors_permission_role_check;

alter table public.investors
  add constraint investors_permission_role_check
  check (permission_role in ('viewer', 'operator', 'manager', 'admin'));

commit;

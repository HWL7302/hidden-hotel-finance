-- Phase 4: investor management V3.
-- Run once in Supabase SQL Editor after phase-4-investor-management-v2.sql.
-- This script adds a reserved investor permission field without enabling full RBAC.

alter table public.investors
  add column if not exists permission_role text default 'viewer';

update public.investors
set permission_role = 'viewer'
where permission_role is null;

alter table public.investors
  alter column permission_role set default 'viewer',
  alter column permission_role set not null;

alter table public.investors
  drop constraint if exists investors_permission_role_check;

alter table public.investors
  add constraint investors_permission_role_check
  check (permission_role in ('viewer', 'operator', 'admin'));

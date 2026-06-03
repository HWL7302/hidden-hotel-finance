-- Phase 4: investor management V1.
-- Run once in Supabase SQL Editor before using /dashboard/investors.
-- This script is additive and does not drop existing investor data.

alter table public.investors
  add column if not exists email text,
  add column if not exists contact text,
  add column if not exists permission_role text default 'viewer',
  add column if not exists notes text;

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

alter table public.investors
  drop constraint if exists investors_share_ratio_check;

create table if not exists public.investment_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  investor_id uuid not null references public.investors(id) on delete cascade,
  investment_type text not null check (
    investment_type in (
      'cash',
      'rent_equity',
      'equipment',
      'additional',
      'other',
      'withdrawal',
      'transfer'
    )
  ),
  amount numeric not null default 0,
  share_ratio numeric not null default 0,
  investment_date date not null default current_date,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investment_records_store_date_idx
  on public.investment_records (store_id, investment_date desc);

create index if not exists investment_records_investor_idx
  on public.investment_records (investor_id);

alter table public.investment_records enable row level security;

grant select, insert, update, delete on table public.investors to authenticated;
grant select, insert, update, delete on table public.investment_records to authenticated;

drop policy if exists "investors admin all" on public.investors;
create policy "investors admin all"
  on public.investors for all
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() = 'admin'
    and public.current_profile_store_id() = store_id
  )
  with check (
    auth.uid() is not null
    and public.current_profile_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

drop policy if exists "investment records admin all" on public.investment_records;
create policy "investment records admin all"
  on public.investment_records for all
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() = 'admin'
    and public.current_profile_store_id() = store_id
  )
  with check (
    auth.uid() is not null
    and public.current_profile_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_investors_updated_at on public.investors;
create trigger set_investors_updated_at
before update on public.investors
for each row execute function public.set_updated_at();

drop trigger if exists set_investment_records_updated_at on public.investment_records;
create trigger set_investment_records_updated_at
before update on public.investment_records
for each row execute function public.set_updated_at();

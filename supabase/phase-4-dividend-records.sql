-- Phase 4: dividend records V1.
-- Run once in Supabase SQL Editor before using /dashboard/dividends.
-- This script is additive and does not modify the legacy dividends table.

create table if not exists public.dividend_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  settlement_month date not null check (date_trunc('month', settlement_month)::date = settlement_month),
  investor_id uuid not null references public.investors(id) on delete cascade,
  investor_name text not null,
  share_ratio numeric not null default 0 check (share_ratio >= 0),
  expected_amount numeric not null default 0 check (expected_amount >= 0),
  paid_amount numeric not null default 0 check (paid_amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'deferred')),
  paid_date date,
  receipt_id uuid references public.evidence_files(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, settlement_month, investor_id)
);

create index if not exists dividend_records_store_month_idx
  on public.dividend_records (store_id, settlement_month);

create index if not exists dividend_records_investor_idx
  on public.dividend_records (investor_id);

alter table public.dividend_records enable row level security;

grant select, insert, update, delete on table public.dividend_records to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dividend_records_updated_at on public.dividend_records;
create trigger set_dividend_records_updated_at
before update on public.dividend_records
for each row execute function public.set_updated_at();

drop policy if exists "dividend records admin all" on public.dividend_records;
create policy "dividend records admin all"
  on public.dividend_records for all
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

drop policy if exists "dividend records investor own select" on public.dividend_records;
create policy "dividend records investor own select"
  on public.dividend_records for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() = 'investor'
    and public.current_profile_store_id() = store_id
    and exists (
      select 1
      from public.investors i
      where i.id = investor_id
        and i.user_id = auth.uid()
        and i.store_id = store_id
    )
  );

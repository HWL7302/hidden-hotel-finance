-- Phase 4: investor management V2.
-- Run once in Supabase SQL Editor after phase-4-investor-management.sql.
-- This script is additive and keeps legacy investment types compatible.

create table if not exists public.store_finance_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  investment_baseline numeric not null default 420000 check (investment_baseline > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.store_finance_settings (store_id)
select id
from public.stores
on conflict (store_id) do nothing;

alter table public.store_finance_settings enable row level security;

grant select, insert, update on table public.store_finance_settings to authenticated;

drop policy if exists "store finance settings admin all" on public.store_finance_settings;
create policy "store finance settings admin all"
  on public.store_finance_settings for all
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

drop policy if exists "store finance settings select by store role" on public.store_finance_settings;
create policy "store finance settings select by store role"
  on public.store_finance_settings for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
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

drop trigger if exists set_store_finance_settings_updated_at on public.store_finance_settings;
create trigger set_store_finance_settings_updated_at
before update on public.store_finance_settings
for each row execute function public.set_updated_at();

-- The V2 UI no longer allows creating withdrawal or transfer as ordinary
-- investment records. The database still accepts these legacy values so
-- existing records are not broken before a future equity-change workflow.
alter table public.investment_records
  drop constraint if exists investment_records_investment_type_check;

alter table public.investment_records
  add constraint investment_records_investment_type_check
  check (
    investment_type in (
      'cash',
      'rent_equity',
      'equipment',
      'additional',
      'other',
      'withdrawal',
      'transfer'
    )
  );

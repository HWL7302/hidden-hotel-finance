create extension if not exists "pgcrypto";

create type public.profile_role as enum ('admin', 'operator', 'investor');
create type public.record_status as enum ('draft', 'confirmed', 'locked', 'void');
create type public.evidence_owner_type as enum ('income', 'expense', 'room', 'monthly_closing', 'dividend', 'other');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id),
  email text not null,
  full_name text,
  role public.profile_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  income_date date not null,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  payment_method text,
  description text,
  status public.record_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  expense_date date not null,
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  payment_method text,
  vendor text,
  description text,
  status public.record_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  room_number text not null,
  tenant_name text,
  contract_type text not null,
  monthly_rent numeric(14, 2) not null default 0 check (monthly_rent >= 0),
  deposit_amount numeric(14, 2) not null default 0 check (deposit_amount >= 0),
  start_date date,
  end_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  profile_id uuid references public.profiles(id),
  name text not null,
  investment_amount numeric(14, 2) not null check (investment_amount >= 0),
  share_percentage numeric(7, 4) not null check (share_percentage >= 0 and share_percentage <= 100),
  paid_dividend_total numeric(14, 2) not null default 0 check (paid_dividend_total >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  closing_month date not null,
  total_income numeric(14, 2) not null default 0,
  total_expense numeric(14, 2) not null default 0,
  net_profit numeric(14, 2) not null default 0,
  dividend_pool numeric(14, 2) not null default 0,
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, closing_month)
);

create table public.dividends (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  monthly_closing_id uuid not null references public.monthly_closings(id),
  investor_id uuid not null references public.investors(id),
  expected_amount numeric(14, 2) not null default 0 check (expected_amount >= 0),
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  paid_at date,
  status public.record_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  owner_type public.evidence_owner_type not null,
  owner_id uuid,
  bucket_name text not null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text not null,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index incomes_store_date_idx on public.incomes (store_id, income_date);
create index expenses_store_date_idx on public.expenses (store_id, expense_date);
create index rooms_store_active_idx on public.rooms (store_id, is_active);
create index investors_store_active_idx on public.investors (store_id, is_active);
create index monthly_closings_store_month_idx on public.monthly_closings (store_id, closing_month);
create index dividends_investor_idx on public.dividends (investor_id);
create index evidence_files_owner_idx on public.evidence_files (owner_type, owner_id);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.rooms enable row level security;
alter table public.investors enable row level security;
alter table public.monthly_closings enable row level security;
alter table public.dividends enable row level security;
alter table public.evidence_files enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.stores to authenticated;
grant select, insert, update, delete on table public.incomes to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;

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

drop policy if exists "profiles can read own profile" on public.profiles;
drop policy if exists "admins can read all profiles" on public.profiles;
drop policy if exists "profile select own or admin" on public.profiles;
drop policy if exists "admins can read all business data" on public.stores;
drop policy if exists "operators can read stores" on public.stores;
drop policy if exists "store select own store" on public.stores;
drop policy if exists "operators can insert incomes" on public.incomes;
drop policy if exists "income select by store role" on public.incomes;
drop policy if exists "income insert by admin operator" on public.incomes;
drop policy if exists "income update by admin operator" on public.incomes;
drop policy if exists "income delete by admin operator" on public.incomes;
drop policy if exists "operators can insert expenses" on public.expenses;
drop policy if exists "expense select by store role" on public.expenses;
drop policy if exists "expense insert by admin operator" on public.expenses;
drop policy if exists "expense update by admin operator" on public.expenses;
drop policy if exists "expense delete by admin operator" on public.expenses;

create policy "profile select own or admin"
  on public.profiles for select
  using (
    auth.uid() is not null
    and id = auth.uid()
  );

create policy "store select own store"
  on public.stores for select
  using (
    auth.uid() is not null
    and id = public.current_profile_store_id()
  );

create policy "income select by store role"
  on public.incomes for select
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
    and public.current_profile_store_id() = incomes.store_id
  );

create policy "income insert by admin operator"
  on public.incomes for insert
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = incomes.store_id
  );

create policy "income update by admin operator"
  on public.incomes for update
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = incomes.store_id
  )
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = incomes.store_id
  );

create policy "income delete by admin operator"
  on public.incomes for delete
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = incomes.store_id
  );

create policy "expense select by store role"
  on public.expenses for select
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
    and public.current_profile_store_id() = expenses.store_id
  );

create policy "expense insert by admin operator"
  on public.expenses for insert
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = expenses.store_id
  );

create policy "expense update by admin operator"
  on public.expenses for update
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = expenses.store_id
  )
  with check (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = expenses.store_id
  );

create policy "expense delete by admin operator"
  on public.expenses for delete
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator')
    and public.current_profile_store_id() = expenses.store_id
  );

create policy "operators can insert evidence"
  on public.evidence_files for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  );

create policy "investors can read own investor row"
  on public.investors for select
  using (profile_id = auth.uid());

create policy "investors can read own dividends"
  on public.dividends for select
  using (
    exists (
      select 1 from public.investors i
      where i.id = dividends.investor_id and i.profile_id = auth.uid()
    )
  );

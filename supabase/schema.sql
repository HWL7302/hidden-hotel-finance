create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'operator', 'investor');
create type public.income_source as enum ('meituan', 'douyin', 'wechat_offline', 'long_stay', 'other');
create type public.expense_category as enum (
  'rent',
  'salary',
  'utilities',
  'network',
  'game_membership',
  'cleaning_supplies',
  'repair',
  'platform_promotion',
  'renovation_equipment',
  'other'
);
create type public.customer_type as enum ('long_stay', 'monthly_rent', 'package_month', 'special_discount');
create type public.room_status as enum ('active', 'checked_out', 'cancelled');
create type public.dividend_status as enum ('pending', 'paid', 'partial', 'cancelled');
create type public.evidence_type as enum ('income', 'expense', 'dividend', 'long_stay_payment', 'other');
create type public.audit_action as enum ('insert', 'update', 'delete', 'locked_month_update', 'close_month', 'lock_month');

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '贵阳',
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'investor',
  store_id uuid references public.stores(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  date date not null,
  source public.income_source not null,
  gross_amount numeric not null default 0 check (gross_amount >= 0),
  fee_amount numeric not null default 0 check (fee_amount >= 0),
  net_amount numeric not null default 0 check (net_amount >= 0),
  settlement_period date not null,
  note text,
  evidence_file uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  date date not null,
  category public.expense_category not null,
  amount numeric not null default 0 check (amount >= 0),
  payee text,
  payment_method text,
  included_in_monthly_cost boolean not null default true,
  note text,
  evidence_file uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  room_number text not null,
  customer_name_or_code text not null,
  customer_type public.customer_type not null,
  monthly_rent numeric not null default 0 check (monthly_rent >= 0),
  check_in_date date not null,
  expected_check_out_date date,
  actual_check_out_date date,
  payment_received numeric not null default 0 check (payment_received >= 0),
  payment_evidence_file uuid,
  note text,
  status public.room_status not null default 'active',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  name text not null,
  email text,
  contact text,
  permission_role text not null default 'viewer' check (
    permission_role in ('viewer', 'operator', 'admin')
  ),
  user_id uuid references auth.users(id),
  investment_amount numeric not null default 0 check (investment_amount >= 0),
  share_ratio numeric not null default 0,
  total_dividend_received numeric not null default 0 check (total_dividend_received >= 0),
  note text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_finance_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  investment_baseline numeric not null default 420000 check (investment_baseline > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.investment_records (
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

create table public.monthly_closings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  month date not null check (date_trunc('month', month)::date = month),
  total_income numeric not null default 0,
  income_by_source jsonb not null default '{}',
  total_expense numeric not null default 0,
  expense_by_category jsonb not null default '{}',
  net_profit numeric not null default 0,
  distributable_profit numeric not null default 0,
  paid_dividend_amount numeric not null default 0,
  unpaid_dividend_amount numeric not null default 0,
  is_closed boolean not null default false,
  is_locked boolean not null default false,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  locked_by uuid references auth.users(id),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, month)
);

create table public.dividends (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  month date not null check (date_trunc('month', month)::date = month),
  investor_id uuid not null references public.investors(id),
  expected_amount numeric not null default 0 check (expected_amount >= 0),
  actual_amount numeric not null default 0 check (actual_amount >= 0),
  paid_date date,
  payment_method text,
  evidence_file uuid,
  status public.dividend_status not null default 'pending',
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dividend_records (
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

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  evidence_type public.evidence_type not null,
  file_url text not null,
  file_name text not null,
  file_type text not null check (file_type in ('jpg', 'jpeg', 'png', 'webp', 'pdf', 'xlsx', 'csv')),
  storage_bucket text not null default 'evidence-files',
  storage_path text not null,
  related_table text,
  related_record_id uuid,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.incomes
  add constraint incomes_evidence_file_fkey foreign key (evidence_file) references public.evidence_files(id);
alter table public.expenses
  add constraint expenses_evidence_file_fkey foreign key (evidence_file) references public.evidence_files(id);
alter table public.rooms
  add constraint rooms_payment_evidence_file_fkey foreign key (payment_evidence_file) references public.evidence_files(id);
alter table public.dividends
  add constraint dividends_evidence_file_fkey foreign key (evidence_file) references public.evidence_files(id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  user_id uuid references auth.users(id),
  action public.audit_action not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index incomes_store_date_idx on public.incomes (store_id, date);
create index expenses_store_date_idx on public.expenses (store_id, date);
create index rooms_store_status_idx on public.rooms (store_id, status);
create index investors_store_active_idx on public.investors (store_id, is_active);
create index investors_email_lower_idx on public.investors (lower(email));
create index investment_records_store_date_idx on public.investment_records (store_id, investment_date desc);
create index investment_records_investor_idx on public.investment_records (investor_id);
create index monthly_closings_store_month_idx on public.monthly_closings (store_id, month);
create index dividends_investor_idx on public.dividends (investor_id);
create index dividends_store_month_idx on public.dividends (store_id, month);
create index dividend_records_store_month_idx on public.dividend_records (store_id, settlement_month);
create index dividend_records_investor_idx on public.dividend_records (investor_id);
create index evidence_files_store_type_idx on public.evidence_files (store_id, evidence_type);
create index audit_logs_store_created_idx on public.audit_logs (store_id, created_at desc);

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.store_finance_settings enable row level security;
alter table public.incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.rooms enable row level security;
alter table public.investors enable row level security;
alter table public.investment_records enable row level security;
alter table public.monthly_closings enable row level security;
alter table public.dividends enable row level security;
alter table public.dividend_records enable row level security;
alter table public.evidence_files enable row level security;
alter table public.audit_logs enable row level security;

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

create or replace function public.current_investor_profile()
returns table (
  id uuid,
  investment_amount numeric,
  share_ratio numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.investment_amount, i.share_ratio
  from public.investors i
  where trim(lower(i.email)) = trim(lower(coalesce(auth.jwt() ->> 'email', '')))
    and i.is_active = true
  order by i.created_at desc
  limit 1
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_fixed_admin_investor_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fixed_email constant text := 'kiu9ninomi@gmail.com';
  current_email text := trim(lower(coalesce(auth.jwt() ->> 'email', '')));
begin
  if tg_op = 'DELETE' then
    if trim(lower(old.email)) = fixed_email and current_email <> fixed_email then
      raise exception 'Fixed administrator investor record is protected.';
    end if;

    return old;
  end if;

  if (
    trim(lower(coalesce(old.email, ''))) = fixed_email
    or trim(lower(coalesce(new.email, ''))) = fixed_email
  ) and current_email <> fixed_email then
    raise exception 'Fixed administrator investor record is protected.';
  end if;

  if trim(lower(coalesce(old.email, ''))) = fixed_email then
    new.email := fixed_email;
    new.permission_role := 'admin';
    new.is_active := true;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_fixed_admin_investment_record_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fixed_email constant text := 'kiu9ninomi@gmail.com';
  current_email text := trim(lower(coalesce(auth.jwt() ->> 'email', '')));
  target_investor_id uuid;
begin
  if tg_op = 'DELETE' then
    target_investor_id := old.investor_id;
  else
    target_investor_id := new.investor_id;
  end if;

  if current_email <> fixed_email and exists (
    select 1
    from public.investors i
    where i.id = target_investor_id
      and trim(lower(i.email)) = fixed_email
  ) then
    raise exception 'Fixed administrator investment records are protected.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger set_dividend_records_updated_at
before update on public.dividend_records
for each row execute function public.set_updated_at();

create trigger prevent_fixed_admin_investor_changes
before update or delete on public.investors
for each row execute function public.prevent_fixed_admin_investor_changes();

create trigger prevent_fixed_admin_investment_record_changes
before insert or update or delete on public.investment_records
for each row execute function public.prevent_fixed_admin_investment_record_changes();

grant usage on schema public to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_store_id() to authenticated;
grant execute on function public.current_investor_permission_role() to authenticated;
grant execute on function public.current_investor_profile() to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.stores to authenticated;
grant select, insert, update on table public.store_finance_settings to authenticated;
grant select, insert, update, delete on table public.incomes to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
grant select, insert, update, delete on table public.investors to authenticated;
grant select, insert, update, delete on table public.investment_records to authenticated;
grant select, insert, update on table public.monthly_closings to authenticated;
grant select, insert, update, delete on table public.dividend_records to authenticated;
grant select, insert, delete on table public.evidence_files to authenticated;

create policy "profile select own"
  on public.profiles for select
  to authenticated
  using (auth.uid() is not null and id = auth.uid());

create policy "store select own"
  on public.stores for select
  to authenticated
  using (auth.uid() is not null and id = public.current_profile_store_id());

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

create policy "store finance settings select by store role"
  on public.store_finance_settings for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
    and public.current_profile_store_id() = store_id
  );

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
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
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

create policy "monthly closings select by store role"
  on public.monthly_closings for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_profile_role() in ('admin', 'operator', 'investor')
    and public.current_profile_store_id() = store_id
  );

create policy "monthly closings insert by admin"
  on public.monthly_closings for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_profile_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

create policy "monthly closings update by admin"
  on public.monthly_closings for update
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

create policy "dividend records admin all"
  on public.dividend_records for all
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and public.current_profile_store_id() = store_id
  )
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

create policy "dividend records investor own select"
  on public.dividend_records for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'viewer'
    and public.current_profile_store_id() = store_id
    and exists (
      select 1
      from public.investors i
      where i.id = investor_id
        and trim(lower(i.email)) = trim(lower(coalesce(auth.jwt() ->> 'email', '')))
        and i.store_id = store_id
        and i.is_active = true
    )
  );

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
    and public.current_investor_permission_role() in ('admin', 'operator')
    and public.current_profile_store_id() = store_id
    and uploaded_by = auth.uid()
  );

create policy "evidence delete by admin"
  on public.evidence_files for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and public.current_profile_store_id() = store_id
  );

insert into storage.buckets (id, name, public)
values ('evidence-files', 'evidence-files', false)
on conflict (id) do update set public = excluded.public;

create policy "evidence storage select by store role"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

create policy "evidence storage insert by admin operator"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'evidence-files'
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (storage.foldername(name))[1] = public.current_profile_store_id()::text
  );

create policy "evidence storage delete by admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence-files'
    and public.current_investor_permission_role() = 'admin'
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

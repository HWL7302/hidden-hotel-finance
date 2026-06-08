-- Phase 7: room ledger and monthly rent records.
-- Run this script once in the Supabase SQL Editor before enabling the room/monthly rent page.

begin;

alter table public.rooms
  add column if not exists room_type text,
  add column if not exists management_status text not null default 'vacant',
  add column if not exists notes text;

update public.rooms
set notes = coalesce(notes, note)
where notes is null and note is not null;

alter table public.rooms
  drop constraint if exists rooms_management_status_check;

alter table public.rooms
  add constraint rooms_management_status_check
  check (
    management_status in (
      'vacant',
      'monthly_rented',
      'short_term',
      'maintenance',
      'inactive'
    )
  );

create table if not exists public.monthly_rent_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  room_id uuid not null references public.rooms(id) on delete restrict,
  tenant_name text not null,
  tenant_contact text,
  monthly_rent numeric not null default 0 check (monthly_rent >= 0),
  deposit numeric not null default 0 check (deposit >= 0),
  start_date date not null,
  end_date date,
  status text not null default 'active' check (
    status in ('active', 'ended', 'paused', 'overdue')
  ),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_store_management_status_idx
  on public.rooms (store_id, management_status);

create index if not exists monthly_rent_records_store_status_idx
  on public.monthly_rent_records (store_id, status);

create index if not exists monthly_rent_records_room_start_idx
  on public.monthly_rent_records (room_id, start_date desc);

alter table public.monthly_rent_records enable row level security;

grant select, insert, update, delete on table public.rooms to authenticated;
grant select, insert, update, delete on table public.monthly_rent_records to authenticated;

drop policy if exists "rooms select by store role" on public.rooms;
drop policy if exists "rooms insert by admin operator" on public.rooms;
drop policy if exists "rooms update by admin operator" on public.rooms;
drop policy if exists "rooms delete by admin" on public.rooms;

create policy "rooms select by store role"
  on public.rooms for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = rooms.store_id
      )
    )
  );

create policy "rooms insert by admin operator"
  on public.rooms for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = rooms.store_id
      )
    )
  );

create policy "rooms update by admin operator"
  on public.rooms for update
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = rooms.store_id
      )
    )
  )
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = rooms.store_id
      )
    )
  );

create policy "rooms delete by admin"
  on public.rooms for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = rooms.store_id
      )
    )
  );

drop policy if exists "monthly rent records select by store role" on public.monthly_rent_records;
drop policy if exists "monthly rent records insert by admin operator" on public.monthly_rent_records;
drop policy if exists "monthly rent records update by admin operator" on public.monthly_rent_records;
drop policy if exists "monthly rent records delete by admin" on public.monthly_rent_records;

create policy "monthly rent records select by store role"
  on public.monthly_rent_records for select
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator', 'viewer')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = monthly_rent_records.store_id
      )
    )
  );

create policy "monthly rent records insert by admin operator"
  on public.monthly_rent_records for insert
  to authenticated
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = monthly_rent_records.store_id
      )
    )
  );

create policy "monthly rent records update by admin operator"
  on public.monthly_rent_records for update
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = monthly_rent_records.store_id
      )
    )
  )
  with check (
    auth.uid() is not null
    and public.current_investor_permission_role() in ('admin', 'operator')
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = monthly_rent_records.store_id
      )
    )
  );

create policy "monthly rent records delete by admin"
  on public.monthly_rent_records for delete
  to authenticated
  using (
    auth.uid() is not null
    and public.current_investor_permission_role() = 'admin'
    and (
      public.current_profile_store_id() = store_id
      or exists (
        select 1
        from public.current_investor_profile() p
        where p.store_id = monthly_rent_records.store_id
      )
    )
  );

commit;

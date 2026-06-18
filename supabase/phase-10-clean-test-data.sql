-- Phase 10 draft: clean pre-production test data for Hidden Hotel Finance.
--
-- DRAFT ONLY. DO NOT RUN UNTIL THE TARGET STORE AND RETENTION LIST ARE CONFIRMED.
-- This file is not called by the application and does not alter schemas, RLS,
-- functions, triggers, policies, auth.users, storage buckets, or configuration.
--
-- Safety locks in both plans:
--   1. cleanup_enabled defaults to false.
--   2. confirmation_text does not match the required phrase.
--   3. target_store_id defaults to null.
--   4. Each transaction ends with ROLLBACK.
--
-- Before an approved cleanup:
--   1. Find and verify the Hidden Hotel store UUID in public.stores.
--   2. Back up the database.
--   3. Export the evidence paths with the read-only query below.
--   4. Delete those objects through the Supabase Storage UI/API if approved.
--      Do not delete rows directly from storage.objects and do not delete the
--      evidence-files bucket. SQL deletion of public.evidence_files does not
--      remove the physical Storage objects.
--   5. Enable exactly one plan, enter its confirmation phrase and store UUID,
--      review the affected rows, then replace only that plan's final ROLLBACK
--      with COMMIT.

-- Read-only preparation queries. Replace the UUID only when reviewing data.
-- select id, name, city, is_active from public.stores order by created_at;
-- select storage_bucket, storage_path, file_name
-- from public.evidence_files
-- where store_id = '00000000-0000-0000-0000-000000000000'::uuid
-- order by created_at;

-- ============================================================================
-- PLAN A: Remove business test transactions, keep users and role mappings.
-- ============================================================================
-- Keeps:
--   auth.users, profiles, investors, investment_records, stores,
--   store_finance_settings, permission roles, fixed-admin protection, RLS.
-- Removes for one store:
--   incomes, expenses, both dividend tables, monthly closings, rooms,
--   monthly rent records, evidence metadata, and audit logs.

begin;

do $$
declare
  cleanup_enabled constant boolean := false;
  confirmation_text constant text := 'NOT CONFIRMED';
  target_store_id constant uuid := null;
  required_confirmation constant text :=
    'CLEAR HIDDEN HOTEL TEST BUSINESS DATA';
  deleted_count bigint;
begin
  if not cleanup_enabled
    or confirmation_text <> required_confirmation
    or target_store_id is null
  then
    raise notice 'PLAN A SAFE MODE: no data was deleted.';
    return;
  end if;

  if not exists (
    select 1 from public.stores where id = target_store_id
  ) then
    raise exception 'PLAN A stopped: target_store_id does not exist.';
  end if;

  -- Delete dependent records before their parents and evidence metadata.
  delete from public.dividend_records where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A dividend_records: %', deleted_count;

  delete from public.dividends where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A dividends: %', deleted_count;

  delete from public.monthly_rent_records where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A monthly_rent_records: %', deleted_count;

  delete from public.rooms where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A rooms: %', deleted_count;

  delete from public.incomes where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A incomes: %', deleted_count;

  delete from public.expenses where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A expenses: %', deleted_count;

  delete from public.monthly_closings where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A monthly_closings: %', deleted_count;

  delete from public.evidence_files where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A evidence_files metadata: %', deleted_count;

  delete from public.audit_logs where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN A audit_logs: %', deleted_count;
end;
$$;

-- Safety default. Change to COMMIT only after reviewing an approved dry run.
rollback;

-- ============================================================================
-- PLAN B: Remove business data plus explicitly selected test investors.
-- ============================================================================
-- Keeps:
--   auth.users, profiles, stores, store_finance_settings, schema, RLS,
--   functions, triggers, policies, and the fixed administrator investor row.
-- Also removes:
--   investment_records and investors selected by explicit email/UUID lists.
--
-- Never add kiu9ninomi@gmail.com to the test list. The SQL excludes it even if
-- entered accidentally. Removing a test login from Supabase Auth is a separate
-- manual dashboard action and is intentionally not performed here.

begin;

do $$
declare
  cleanup_enabled constant boolean := false;
  confirmation_text constant text := 'NOT CONFIRMED';
  target_store_id constant uuid := null;
  required_confirmation constant text :=
    'CLEAR HIDDEN HOTEL TEST BUSINESS AND INVESTOR DATA';
  fixed_admin_email constant text := 'kiu9ninomi@gmail.com';

  -- Enter only reviewed test identities. Keep entries lowercase and exact.
  test_investor_emails constant text[] := array[]::text[];
  test_investor_ids constant uuid[] := array[]::uuid[];
  deleted_count bigint;
begin
  if not cleanup_enabled
    or confirmation_text <> required_confirmation
    or target_store_id is null
  then
    raise notice 'PLAN B SAFE MODE: no data was deleted.';
    return;
  end if;

  if cardinality(test_investor_emails) = 0
    and cardinality(test_investor_ids) = 0
  then
    raise exception 'PLAN B stopped: no test investors were selected.';
  end if;

  if not exists (
    select 1 from public.stores where id = target_store_id
  ) then
    raise exception 'PLAN B stopped: target_store_id does not exist.';
  end if;

  -- Clear all business test data for the selected store.
  delete from public.dividend_records where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B dividend_records: %', deleted_count;

  delete from public.dividends where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B dividends: %', deleted_count;

  delete from public.monthly_rent_records where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B monthly_rent_records: %', deleted_count;

  delete from public.rooms where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B rooms: %', deleted_count;

  delete from public.incomes where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B incomes: %', deleted_count;

  delete from public.expenses where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B expenses: %', deleted_count;

  delete from public.monthly_closings where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B monthly_closings: %', deleted_count;

  delete from public.evidence_files where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B evidence_files metadata: %', deleted_count;

  delete from public.audit_logs where store_id = target_store_id;
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B audit_logs: %', deleted_count;

  -- Delete investment history before deleting its investor mapping rows.
  delete from public.investment_records ir
  where ir.store_id = target_store_id
    and ir.investor_id in (
      select i.id
      from public.investors i
      where i.store_id = target_store_id
        and lower(trim(coalesce(i.email, ''))) <> fixed_admin_email
        and (
          i.id = any(test_investor_ids)
          or lower(trim(coalesce(i.email, ''))) = any(test_investor_emails)
        )
    );
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B investment_records: %', deleted_count;

  delete from public.investors i
  where i.store_id = target_store_id
    and lower(trim(coalesce(i.email, ''))) <> fixed_admin_email
    and (
      i.id = any(test_investor_ids)
      or lower(trim(coalesce(i.email, ''))) = any(test_investor_emails)
    );
  get diagnostics deleted_count = row_count;
  raise notice 'PLAN B investors: %', deleted_count;
end;
$$;

-- Safety default. Change to COMMIT only after reviewing an approved dry run.
rollback;

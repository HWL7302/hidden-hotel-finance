-- Read-only verification for the active Phase 2 access chain.

with audit_rows as (
  select
    '01_columns' as section,
    c.table_name || '.' || c.column_name as object_name,
    jsonb_build_object(
      'table', c.table_name,
      'column', c.column_name,
      'position', c.ordinal_position,
      'data_type', c.data_type,
      'udt_name', c.udt_name,
      'nullable', c.is_nullable,
      'default', c.column_default
    ) as details
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in ('profiles', 'stores', 'incomes', 'expenses')

  union all

  select
    '02_enums',
    typ.typname || '.' || e.enumlabel,
    jsonb_build_object(
      'enum_name', typ.typname,
      'enum_value', e.enumlabel,
      'sort_order', e.enumsortorder
    )
  from pg_type typ
  join pg_enum e on typ.oid = e.enumtypid
  join pg_namespace n on n.oid = typ.typnamespace
  where n.nspname = 'public'
    and typ.typname in ('app_role', 'income_source', 'expense_category')

  union all

  select
    '03_rls',
    c.relname,
    jsonb_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'stores', 'incomes', 'expenses')

  union all

  select
    '04_policies',
    p.tablename || '.' || p.policyname,
    jsonb_build_object(
      'table', p.tablename,
      'policy_name', p.policyname,
      'roles', p.roles,
      'command', p.cmd,
      'using', p.qual,
      'with_check', p.with_check
    )
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('profiles', 'stores', 'incomes', 'expenses')

  union all

  select
    '05_grants',
    g.table_name || '.' || g.grantee || '.' || g.privilege_type,
    jsonb_build_object(
      'table', g.table_name,
      'grantee', g.grantee,
      'privilege', g.privilege_type
    )
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.table_name in ('profiles', 'stores', 'incomes', 'expenses')
    and g.grantee in ('anon', 'authenticated')
)
select section, object_name, details
from audit_rows
order by section, object_name;

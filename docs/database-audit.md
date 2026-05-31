# Database Audit Snapshot

Audit date: `2026-05-31`

## Authority

The live Supabase project is authoritative for deployed database structure and
access control. `supabase/schema.sql` is the checked-in reconstruction baseline.

The audit used an exported Supabase catalog snapshot and a successful execution
of `supabase/reconcile-core-access.sql`.

## Existing Tables

```text
stores
profiles
incomes
expenses
rooms
investors
monthly_closings
dividends
evidence_files
audit_logs
```

The live database does not contain a `distributions` table. Dividend records use
`dividends`.

## Active CRUD Tables

### incomes

```text
id
store_id
date
source
gross_amount
fee_amount
net_amount
settlement_period
note
evidence_file
created_by
created_at
updated_at
```

`source` uses `income_source`. `settlement_period` is a required `date`.

### expenses

```text
id
store_id
date
category
amount
payee
payment_method
included_in_monthly_cost
note
evidence_file
created_by
created_at
updated_at
```

`category` uses `expense_category`. `payment_method` is `text`.

## CRUD Enum Values

`income_source`:

```text
meituan
douyin
wechat_offline
long_stay
other
```

`expense_category`:

```text
rent
salary
utilities
network
game_membership
cleaning_supplies
repair
platform_promotion
renovation_equipment
other
```

## Core Access Chain

The reconciled Phase 2 access chain covers:

```text
profiles
stores
incomes
expenses
```

Expected behavior:

- Anonymous users cannot access these tables.
- Authenticated users can read their own profile.
- Authenticated users can read their assigned store.
- `admin` and `operator` can select, insert, update, and delete income and
  expense rows for their assigned store.
- `investor` can select income and expense rows for their assigned store.
- Inserts require `created_by = auth.uid()`.

## Deferred Modules

The live database already contains tables and policies for rooms, investors,
monthly closings, dividends, evidence files, and audit logs. Their application
features remain deferred. Review their live policies before implementing each
module; do not infer behavior from old local files.

## Verification Checklist

After a database-related change:

```bash
git status
npm run typecheck
npm run build
npm run dev
```

Then verify:

1. Email/password login.
2. Dashboard access.
3. Income list, month filter, create, refresh persistence, edit, and delete.
4. Expense list, month filter, create, refresh persistence, edit, and delete.
5. No `permission denied` errors.
6. No enum write errors.

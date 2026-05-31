# Device Handoff Guide

## Source Of Truth

Use these two sources as the only project baselines:

1. GitHub `main`: application code, documentation, and SQL snapshots.
2. The live Supabase project: deployed tables, enums, indexes, grants, and RLS policies.

Do not use an older local folder as the source of truth. Do not copy
`node_modules`, `.next`, logs, or `.env.local` between computers.

## Restore On A New Computer

```bash
git clone https://github.com/HWL7302/hidden-hotel-finance.git
cd hidden-hotel-finance
npm install
```

Create `.env.local` locally with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gwskuuggsiincxpchrcy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Then verify:

```bash
git pull origin main
npm run typecheck
npm run build
npm run dev
```

Next.js normally uses `http://localhost:3000`. If port `3000` is already in
use, Next.js prints the actual fallback URL, such as `http://localhost:3001`.
Always use the URL printed by the current terminal session.

Do not run `npm run build` while a dev server from the same project is active.
Both commands use `.next`; stop the dev server, run the build, then start dev
again.

## Resume Development On An Existing Computer

Before making changes:

```bash
git status
git pull origin main
npm install
npm run typecheck
npm run build
npm run dev
```

If `git status` is not clean, review the local changes before pulling. Never use
`git reset --hard`, force push, or overwrite the live Supabase schema to bypass
differences.

## Database Consistency

The checked-in `supabase/schema.sql` records the live Supabase schema baseline.
The live Supabase database remains authoritative when a mismatch is found.

Before changing database-dependent UI:

1. Inspect the live Supabase table columns and enum values.
2. Update `supabase/schema.sql` in the same change.
3. Update the relevant form and query fields.
4. Run `npm run typecheck` and `npm run build`.
5. Test login, dashboard, refresh persistence, edit, and delete.

Use `supabase/reconcile-core-access.sql` only when the access chain for
`profiles`, `stores`, `incomes`, or `expenses` needs to be reconciled.

## Current Completed Scope

- Phase 1 foundation and email/password login.
- Dashboard shell and placeholder module routes.
- Phase 2A income CRUD with month filtering.
- Phase 2B expense CRUD with month filtering.
- Enum-backed income source and expense category selects.
- Fixed expense payment method select backed by a text column.
- Core access reconciliation for `profiles`, `stores`, `incomes`, and
  `expenses`.

## Current Database Enums Used By CRUD

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

## Files That Must Stay Local

The following paths must remain ignored:

```text
.env.local
.env*.local
.next
node_modules
*.log
```

# Development Log

## 2026-05-29

- Recreated Phase 1 project locally.
- Added Next.js App Router foundation.
- Added TypeScript and Tailwind CSS.
- Added Supabase client helpers.
- Added email and password login page using `signInWithPassword`.
- Added protected dashboard layout.
- Added current user email display.
- Added sign out button.
- Added module placeholder pages.
- Added documentation files.
- Added `supabase/schema.sql`.
- Added `.env.example` and `.gitignore`.

## 2026-05-30

- Started Phase 2A.
- Implemented income management CRUD using the Supabase `incomes` table.
- Added income month filtering.
- Added single-record delete with browser confirmation.
- Added page-level Supabase error display for income read, create, update, and delete failures.
- Preserved existing login logic, Supabase Auth configuration, middleware, dashboard shell, and database schema.
- Started Phase 2B.
- Confirmed the real Supabase `expenses` fields: `date`, `category`, `amount`, `payee`, `payment_method`, `included_in_monthly_cost`, and `note`.
- Implemented expense management CRUD using the Supabase `expenses` table.
- Added expense month filtering.
- Added single-record delete with browser confirmation.
- Added RLS and grant SQL for `expenses` alongside the existing `profiles`, `stores`, and `incomes` access chain.
- Kept login logic, Supabase Auth, middleware, and other modules unchanged.

## 2026-05-31

- Audited GitHub `main`, local environment usage, and exported Supabase metadata.
- Replaced the stale local schema snapshot with the live Supabase table, enum, constraint, index, and core access-chain definitions.
- Added a core access reconciliation SQL script for `profiles`, `stores`, `incomes`, and `expenses`.
- Changed income source and expense category inputs to enum-backed selects.
- Changed expense payment method to a fixed select while preserving its database `text` type.
- Reconciled the live Supabase access chain for `profiles`, `stores`, `incomes`, and `expenses`.
- Added cross-device restore, database audit, and read-only verification guidance.
- Started Phase 3A.
- Added Chinese list labels for income sources and expense categories.
- Added fee defaulting, automatic net income calculation, and manual-difference note validation.
- Added the Supabase Storage-backed evidence center for upload, signed viewing, deletion, and income or expense relationships.
- Added the hidden administrator-only development test data cleanup tool.
- Added the Phase 3 evidence bucket, RLS, Storage policy, and cleanup RPC SQL script.
- Moved evidence upload into the income and expense entry forms so files are linked immediately after a record is saved.
- Added evidence viewing columns to the income and expense lists without adding thumbnails or list-side uploads.
- Repositioned the evidence center as an archive with month and income, expense, or other type filters.
- Added disabled OCR-assisted entry buttons as future workflow placeholders. No OCR, AI API, or import feature was implemented.
- Added the first read-only monthly closing page.
- Summarized income by `settlement_period` and expense by `date`, while counting only expenses marked `included_in_monthly_cost`.
- Added monthly income, expense, net profit, evidence completeness, income-source, and expense-category summaries. Evidence completeness covers all monthly income and expense records; expense totals include only records marked as monthly cost.
- Kept dividend calculation, month locking, monthly closing writes, and export outside the first monthly closing scope.

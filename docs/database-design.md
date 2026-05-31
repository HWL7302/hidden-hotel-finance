# Database Design

The database is hosted in Supabase Postgres. The schema is stored in `supabase/schema.sql`.

## Tables

- `stores`: hotel store records.
- `profiles`: application profiles linked to Supabase Auth users.
- `incomes`: income records.
- `expenses`: expense records.
- `rooms`: long-term room and monthly rental records.
- `investors`: investor records.
- `monthly_closings`: monthly financial closing records.
- `dividends`: investor dividend records.
- `evidence_files`: metadata for files stored in Supabase Storage.
- `audit_logs`: immutable audit trail for sensitive changes.

## Data Rules

- Monetary and ratio columns use PostgreSQL `numeric`, not floating-point types.
- Business tables include `store_id`.
- Evidence files are not stored directly in database rows.
- Locked monthly closing records require audit logging before changes.
- GitHub `main` and the live Supabase database are the only project baselines.

## Recorded Enums

- `app_role`: `admin`, `operator`, `investor`
- `income_source`: `meituan`, `douyin`, `wechat_offline`, `long_stay`, `other`
- `expense_category`: `rent`, `salary`, `utilities`, `network`, `game_membership`, `cleaning_supplies`, `repair`, `platform_promotion`, `renovation_equipment`, `other`

## Roles

The `profiles.role` field supports:

- `admin`
- `operator`
- `investor`

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

- Monetary columns use `numeric(14, 2)`.
- Percentage columns use `numeric(7, 4)`.
- Business tables include `store_id`.
- Evidence files are not stored directly in database rows.
- Locked monthly closing records require audit logging before changes.

## Roles

The `profiles.role` field supports:

- `admin`
- `operator`
- `investor`

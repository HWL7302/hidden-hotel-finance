# Database Design

The database is hosted in Supabase Postgres. The schema is stored in `supabase/schema.sql`.

## Tables

- `stores`
- `profiles`
- `incomes`
- `expenses`
- `rooms`
- `investors`
- `monthly_closings`
- `dividends`
- `evidence_files`
- `audit_logs`

Monetary columns use `numeric(14, 2)`. Percentage columns use `numeric(7, 4)`. Business tables include `store_id`. Evidence files are not stored directly in database rows.

# Database Design

The database is hosted in Supabase Postgres. The schema is stored in `supabase/schema.sql`.

## Tables

- `stores`: hotel store records.
- `store_finance_settings`: per-store finance settings such as investment baseline.
- `profiles`: application profiles linked to Supabase Auth users.
- `incomes`: income records.
- `expenses`: expense records.
- `rooms`: long-term room and monthly rental records.
- `investors`: investor records.
- `investment_records`: investor capital contribution and share-change records.
- `monthly_closings`: monthly financial closing records.
- `dividends`: investor dividend records.
- `evidence_files`: metadata for files stored in Supabase Storage.
- `audit_logs`: immutable audit trail for sensitive changes.

## Data Rules

- Monetary and ratio columns use PostgreSQL `numeric`, not floating-point types.
- Business tables include `store_id`.
- Evidence files are not stored directly in database rows.
- Evidence files use the private Supabase Storage bucket `evidence-files`.
- Evidence paths use `<store_id>/receipts/<yyyy>/<mm>/<uuid>.<extension>`.
- Locked monthly closing records require audit logging before changes.
- GitHub `main` and the live Supabase database are the only project baselines.

## Recorded Enums

- `app_role`: `admin`, `operator`, `investor`
- `income_source`: `meituan`, `douyin`, `wechat_offline`, `long_stay`, `other`
- `expense_category`: `rent`, `salary`, `utilities`, `network`, `game_membership`, `cleaning_supplies`, `repair`, `platform_promotion`, `renovation_equipment`, `other`

## Evidence Archive

The live `evidence_files` table stores metadata and paths only. Uploaded file
contents remain in Supabase Storage.

Income and expense entry forms accept an optional evidence upload. The record is
saved first, then the uploaded file metadata is inserted into `evidence_files`
and linked through the record's `evidence_file` field. The archive provides
month and record-type filters plus signed-link viewing.

The first evidence phase supports `jpg`, `jpeg`, `png`, and `pdf`.
The existing schema also reserves metadata values for future import formats.

Future OCR and import work should extend evidence processing around the stored
file path. It should create a reviewable draft and require human confirmation
before writing income or expense records.

## Investor Management V2

The project investment baseline is stored in `store_finance_settings`.
The default database value is `420,000 RMB`, but administrators can update it
from the investor management page.

Investor ownership is calculated from investment records:

```text
share_ratio = investment_records.amount / store_finance_settings.investment_baseline * 100
```

The frontend calculates this value automatically. Users do not manually enter
share ratio.

`investors` stores investor profile data:

- `name`
- `email`
- `contact`
- `permission_role`: reserved page-level permission label, default `viewer`.
  Allowed values are `viewer`, `operator`, and `admin`. This is not the full
  access-control source yet.
- `notes`
- `is_active`

`investment_records` stores each investment or share-change event:

- `investor_id`
- `investment_type`
- `amount`
- `share_ratio`
- `investment_date`
- `notes`

The legacy `description` column may exist for compatibility, but Investor
Management V2 no longer exposes a description field. All free-form text should
go into `notes`.

Current ordinary `investment_type` values:

- `cash`
- `rent_equity`
- `equipment`
- `additional`
- `other`

Withdrawal and transfer are intentionally not ordinary investment record types
in V2. They require a future equity-change workflow. The database constraint
still allows legacy `withdrawal` and `transfer` values so existing records do
not break, but the investor management page does not offer them as selectable
types.

Rent equity is recorded as investment data, not as an operating expense for the
first two years. The current business example is:

```text
5,000 RMB/month * 24 months = 120,000 RMB permanent equity
```

Deferred dividends do not automatically become equity and must not change
`share_ratio` without an explicit investment or share-change record.

Investor summary currently shows payback progress as `0%` because the dividend
record workflow is not implemented yet. The future calculation is:

```text
payback_progress = total_dividend_received / investment_amount * 100
```

## Roles

The `profiles.role` field supports:

- `admin`
- `operator`
- `investor`

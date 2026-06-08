# Database Design

The database is hosted in Supabase Postgres. The schema is stored in `supabase/schema.sql`.

## Tables

- `stores`: hotel store records.
- `store_finance_settings`: per-store finance settings such as investment baseline.
- `profiles`: application profiles linked to Supabase Auth users.
- `incomes`: income records.
- `expenses`: expense records.
- `rooms`: room ledger records plus legacy long-term room fields.
- `monthly_rent_records`: monthly tenant ledger records linked to `rooms`.
- `investors`: investor records.
- `investment_records`: investor capital contribution and share-change records.
- `monthly_closings`: monthly financial closing records.
- `dividends`: investor dividend records.
- `dividend_records`: current dividend workflow records for monthly expected and paid dividends.
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

Investor summary payback progress reads paid dividend records by `investor_id`.
Only `dividend_records.status = 'paid'` rows are included:

```text
payback_progress = paid_dividend_records.paid_amount_sum / investment_records.amount_sum * 100
```

## Dividend Records V1

The active dividend workflow uses `dividend_records`, not the legacy `dividends`
table. The legacy table remains in the schema for compatibility with the initial
database design.

`dividend_records` stores one row per investor per month:

- `store_id`
- `settlement_month`
- `investor_id`
- `investor_name`
- `share_ratio`
- `expected_amount`
- `paid_amount`
- `status`
- `paid_date`
- `receipt_id`
- `notes`

The status values are:

- `unpaid`: not paid
- `paid`: paid
- `deferred`: payment deferred

Dividend V1 generation rules:

```text
distributable_profit = max(monthly_net_profit, 0)
expected_amount = distributable_profit * investor.share_ratio
```

Monthly net profit is calculated with the same rules as Monthly Closing V1:

- income uses `incomes.settlement_period` and sums `net_amount`
- expenses use `expenses.date`
- only expenses with `included_in_monthly_cost = true` are included

V1 does not upload dividend evidence yet. `receipt_id` is reserved for future
linking to `evidence_files`.

## Room And Monthly Rent Ledger V1

The room/monthly rent module is an operating ledger. It does not automatically
write income records. Income remains entered separately in Income Management.

The existing `rooms` table keeps legacy long-stay columns and now also stores
room-ledger fields:

- `room_number`
- `room_type`
- `management_status`: `vacant`, `monthly_rented`, `short_term`,
  `maintenance`, or `inactive`
- `notes`

The `monthly_rent_records` table stores monthly tenant records:

- `store_id`
- `room_id`
- `tenant_name`
- `tenant_contact`
- `monthly_rent`
- `deposit`
- `start_date`
- `end_date`
- `status`: `active`, `ended`, `paused`, or `overdue`
- `notes`

One room can have many historical monthly rent records. Current monthly rent
statistics use records where `status = 'active'` and the selected month falls
within `start_date` and `end_date`.

Admin users can create, edit, and delete rooms and monthly rent records.
Operator users can create and edit rooms and monthly rent records, but cannot
delete them. Viewers can only read the ledger.

## Roles

The `profiles.role` field supports:

- `admin`
- `operator`
- `investor`

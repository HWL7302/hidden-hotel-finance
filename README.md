# Hidden Hotel Finance

电竞酒店财务记账与分红管理系统。项目用于内部账务、收入支出、月度结算、分红追踪、凭证留存和审计。

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Supabase Storage
- Vercel ready

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gwskuuggsiincxpchrcy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

3. Run the development server:

```bash
npm run dev
```

On this Windows workspace, if Node.js is installed at `D:\应用程序\nodejs`,
prefer:

```cmd
start-dev.cmd
```

The helper script keeps the command ASCII-safe, discovers `npm.cmd`, updates
PATH for the current session, and then runs `npm run dev`.

The dev script clears the local `.next` development cache before starting
Next.js. This keeps Windows development sessions from reusing a corrupted Next
dev cache.

4. Open:

```text
http://localhost:3000
```

If port `3000` is occupied, use the fallback URL printed by Next.js, such as
`http://localhost:3001`.

## Development Sync Rules

GitHub `main` and the live Supabase database are the only project baselines. Do
not use stale local files as the source of truth when switching between work
computers.

See `docs/device-handoff.md` for the complete new-device restore checklist,
database consistency workflow, and current handoff snapshot.

Before development on any computer:

```bash
git pull origin main
npm install
# Confirm that .env.local exists and points to the intended Supabase project.
npm run build
npm run dev
```

## Current Scope

### Phase 1

- Email and password login with Supabase Auth
- Dashboard route protection
- Current user email display
- Sign out button
- Basic sidebar layout
- Placeholder pages for all core modules
- Database schema retained in `supabase/schema.sql`

### Phase 2A

- Income management page backed by the Supabase `incomes` table
- Income list
- Month filter
- Create income
- Edit income
- Delete single income with browser confirmation
- `created_by` and default `store_id` handling

### Phase 2B

- Restored income management dashboard card and table layout
- Expense management page backed by the Supabase `expenses` table
- Expense list
- Month filter
- Create expense
- Edit expense
- Delete single expense with browser confirmation
- `created_by` and default `store_id` handling

### Phase 3A

- Chinese display labels for income sources and expense categories
- Income fee defaulting and editable automatic net amount calculation
- Optional evidence upload during income and expense entry
- Supabase Storage-backed evidence archive with month and record-type filters
- Income and expense evidence relationships with signed viewing links
- Hidden administrator-only development data cleanup tool

### Monthly Closing V1

- Read-only monthly operating summary
- Net income total grouped by income settlement period
- Monthly-cost expense total grouped by expense date
- Net profit and evidence completeness cards
- Income-source and expense-category summary tables

## Not Included Yet

- Monthly closing
- Dividend calculation
- Excel import
- PDF export
- Email notifications
- Image recognition
- Complex charts

## Security Notes

- Do not commit `.env.local`.
- Do not use or commit Supabase secret keys.
- Use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the frontend app.

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

4. Open:

```text
http://localhost:3000
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

## Not Included Yet

- Evidence upload
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

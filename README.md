# Hidden Hotel Finance

电竞酒店财务记账与分红管理系统。Phase 1 提供最小可运行的 Next.js App Router 项目、Supabase 邮箱密码登录、基础后台布局、模块占位页面、数据库 schema 和项目文档。

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

## Phase 1 Scope

- Email and password login with Supabase Auth
- Dashboard route protection
- Current user email display
- Sign out button
- Basic sidebar layout
- Placeholder pages for all core modules
- Database schema retained in `supabase/schema.sql`

## Not Included In Phase 1

- Full CRUD
- Excel import
- PDF export
- Email notifications
- Image recognition
- Full dividend calculation
- Complex charts
- Complex UI polish

## Security Notes

- Do not commit `.env.local`.
- Do not use or commit Supabase secret keys.
- Use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the frontend app.

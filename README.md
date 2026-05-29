# Hidden Hotel Finance

电竞酒店财务记账与分红管理系统。Phase 1 提供最小可运行的 Next.js App Router 项目、Supabase 邮箱密码登录、基础后台布局、模块占位页面、数据库 schema 和项目文档。

## Local Setup

```bash
npm install
npm run dev
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://gwskuuggsiincxpchrcy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Open `http://localhost:3000`.

## Phase 1 Scope

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth email/password login
- Protected dashboard and sign out
- Module placeholders
- Database schema and docs

Do not commit `.env.local`, secret keys, service role keys, or database passwords.

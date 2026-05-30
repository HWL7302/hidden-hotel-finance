# AGENTS.md

## Project Rules

- Use English for code, variables, database fields, routes, and file names.
- Use Simplified Chinese for user-facing interface text.
- Do not use pinyin names.
- Keep Phase 1 minimal and runnable.
- Do not add Phase 2 features unless explicitly requested.
- Do not commit `.env.local`, database passwords, service role keys, or other secrets.

## Business Context

Hidden Hotel Finance is an internal finance, monthly closing, dividend tracking, evidence retention, and audit system for an esports hotel.

MVP defaults to one store, but core business tables must keep `store_id` for future multi-store support.

## Access Model

- `admin`: can view and manage all data.
- `operator`: can enter income and expenses, and upload evidence files.
- `investor`: can view only their own investment amount, share percentage, expected dividends, paid dividends, and payback progress.

## Phase 1 Boundaries

Build only the foundation:

- Next.js App Router
- Supabase email/password login
- Dashboard shell
- Module placeholders
- Documentation
- Database schema file

Do not implement complete CRUD, import/export, notifications, image automation, dividend formulas, or complex charting in Phase 1.

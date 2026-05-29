# AGENTS.md

## Rules

- Use English for code, variables, database fields, routes, and file names.
- Use Simplified Chinese for user-facing UI text.
- Do not use pinyin names.
- Keep Phase 1 minimal and runnable.
- Do not add Phase 2 features unless explicitly requested.
- Never commit `.env.local`, secret keys, service role keys, or database passwords.

## Business Context

Hidden Hotel Finance is an internal finance, monthly closing, dividend tracking, evidence retention, and audit system for an esports hotel.

MVP defaults to one store, but core business tables must reserve `store_id`.

## Roles

- `admin`: view and manage all data.
- `operator`: enter income and expenses, and upload evidence files.
- `investor`: view only their own investment amount, share percentage, expected dividends, paid dividends, and payback progress.

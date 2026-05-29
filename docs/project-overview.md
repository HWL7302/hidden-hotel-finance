# Project Overview

Hidden Hotel Finance is a finance and dividend management system for an esports hotel. It supports internal bookkeeping, income and expense tracking, monthly closing, dividend tracking, evidence retention, and audit history.

## Core Modules

- Dashboard
- Income management
- Expense management
- Rooms and monthly rentals
- Monthly closing
- Investor management
- Dividend records
- Evidence center
- Export reports
- Audit logs

## Business Rules

MVP defaults to one store, but core tables reserve `store_id`. Normal short-stay guests are not entered room by room. Rooms/monthly rentals cover only long-term guests, monthly tenants, monthly package rooms, and special discount rooms. Evidence files are stored in Supabase Storage. Money fields use `numeric`, not `float`.

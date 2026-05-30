# Project Overview

Hidden Hotel Finance is a finance and dividend management system for an esports hotel. It supports internal bookkeeping, income and expense tracking, monthly closing, dividend tracking, evidence retention, and audit history.

## Phase 1 Goal

Recreate the foundation of the project on this computer and connect it to the existing Supabase project.

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

- The MVP defaults to one store.
- Core business tables reserve `store_id`.
- Normal short-stay guests are not entered room by room.
- Rooms and monthly rentals only cover long-term guests, monthly tenants, monthly package rooms, and special discount rooms.
- Investors can only view their own investment and dividend data.
- Admins can view all data.
- Operators can enter income, expenses, and upload evidence.
- Evidence files are stored in Supabase Storage; the database stores metadata and paths.
- Money fields use `numeric`, not `float`.
- Locked months cannot be changed through normal edits.
- Changes to locked months must be recorded in `audit_logs`.

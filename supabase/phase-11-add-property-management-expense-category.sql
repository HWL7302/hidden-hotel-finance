-- Hidden Hotel Finance
-- Phase 11: add property management fee expense category.
--
-- Purpose:
--   Allow the app to save the new fixed expense category:
--   property_management = 物业管理费
--
-- Notes:
--   1. This only adds an enum value.
--   2. It does not update, delete, or rewrite historical expense records.
--   3. Historical cleaning_supplies records are kept as-is and displayed as 日常用品 by the app.
--   4. Run this once in Supabase SQL Editor before creating expenses with 物业管理费.

alter type public.expense_category
  add value if not exists 'property_management';

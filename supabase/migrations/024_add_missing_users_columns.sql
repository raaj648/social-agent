-- 024_add_missing_users_columns.sql
-- Add columns referenced by code but missing from the users table.
-- The SELECT query in the dashboard page was failing with 42703,
-- causing the entire profile query to error and show "0 / 100".

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS order_method text DEFAULT 'whatsapp';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS order_link text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============================================================
-- Migration 029: Drop lingering tenant_id columns
-- The tenants table was removed in migration 014. The tenant_id
-- column on connected_pages, instagram_accounts, and
-- whatsapp_accounts was made nullable in 028 but never dropped.
-- No application code references tenant_id anymore.
-- ============================================================

alter table public.connected_pages drop column if exists tenant_id;
alter table public.instagram_accounts drop column if exists tenant_id;
alter table public.whatsapp_accounts drop column if exists tenant_id;
-- 028_drop_tenant_id_not_null.sql
-- The tenants table was removed in migration 014. The tenant_id column
-- on connected_pages, instagram_accounts, and whatsapp_accounts is a
-- remnant that is NOT NULL with no default, causing all INSERTs to fail
-- silently (no application code sets tenant_id).

ALTER TABLE public.connected_pages ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.instagram_accounts ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.whatsapp_accounts ALTER COLUMN tenant_id DROP NOT NULL;

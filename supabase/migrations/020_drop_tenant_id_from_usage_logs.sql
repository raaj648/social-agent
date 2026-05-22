-- Drop tenant_id from usage_logs (tenants table was removed)
alter table public.usage_logs drop column if exists tenant_id cascade;

-- Recreate indexes for user-based lookups
create index if not exists idx_usage_logs_user_id on public.usage_logs(user_id);
create index if not exists idx_usage_logs_user_created on public.usage_logs(user_id, created_at desc);
create index if not exists idx_usage_logs_user_action_date on public.usage_logs(user_id, action, created_at desc);

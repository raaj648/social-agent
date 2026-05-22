-- Fix get_dashboard_stats RPC (re-run with correct schema to fix migration ordering)
drop function if exists public.get_dashboard_stats(uuid);
create function public.get_dashboard_stats(p_tenant_id uuid)
returns table (
  total_pages bigint,
  total_instagram bigint,
  total_whatsapp bigint,
  total_conversations bigint,
  total_messages bigint,
  ai_replies_today bigint,
  quota_used integer,
  quota_daily integer
) as $$
begin
  return query
  select
    (select count(*) from public.connected_pages where tenant_id = p_tenant_id and is_active = true),
    (select count(*) from public.instagram_accounts where tenant_id = p_tenant_id and is_active = true),
    (select count(*) from public.whatsapp_accounts where tenant_id = p_tenant_id and is_active = true),
    (select count(*) from public.conversations where tenant_id = p_tenant_id and is_archived = false),
    (select count(*) from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where c.tenant_id = p_tenant_id),
    (select count(*) from public.usage_logs
      where tenant_id = p_tenant_id
      and action = 'ai_reply'
      and created_at >= current_date),
    (select u.ai_quota_used from public.users u
      join public.tenants t on t.owner_id = u.id
      where t.id = p_tenant_id),
    (select u.ai_quota_daily from public.users u
      join public.tenants t on t.owner_id = u.id
      where t.id = p_tenant_id);
end;
$$ language plpgsql stable;

-- Add username column to users table
alter table public.users add column if not exists username text unique;
create index if not exists idx_users_username on public.users(username);

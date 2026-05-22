-- Cleanup: drop deprecated columns, add missing indexes

-- Drop deprecated tenants.system_prompt (now stored in ai_settings.system_prompt only)
alter table public.tenants drop column if exists system_prompt;

-- Performance indexes for frequently queried columns
create index if not exists idx_conversations_tenant_last_msg
  on public.conversations (tenant_id, last_message_at desc);

create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at asc);

create index if not exists idx_usage_logs_tenant_created
  on public.usage_logs (tenant_id, created_at desc);

create index if not exists idx_usage_logs_tenant_action_date
  on public.usage_logs (tenant_id, action, created_at desc);

create index if not exists idx_connected_pages_tenant
  on public.connected_pages (tenant_id);

create index if not exists idx_instagram_accounts_tenant
  on public.instagram_accounts (tenant_id);

create index if not exists idx_whatsapp_accounts_tenant
  on public.whatsapp_accounts (tenant_id);

create index if not exists idx_knowledge_base_tenant_order
  on public.knowledge_base (tenant_id, sort_order);

create index if not exists idx_orders_tenant_status
  on public.orders (tenant_id, status);

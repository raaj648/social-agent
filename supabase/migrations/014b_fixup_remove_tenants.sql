-- Fixup: complete the migration assuming tenants already dropped

-- Make sure user_id columns exist on all tables
alter table public.conversations add column if not exists user_id uuid;
alter table public.ai_settings add column if not exists user_id uuid;
alter table public.knowledge_base add column if not exists user_id uuid;
alter table public.orders add column if not exists user_id uuid;

-- Set user_id for conversations using channel references or default
update public.conversations c
set user_id = coalesce(
  (select user_id from public.connected_pages where connected_pages.id = c.page_id limit 1),
  (select user_id from public.instagram_accounts where instagram_accounts.id = c.instagram_id limit 1),
  (select user_id from public.whatsapp_accounts where whatsapp_accounts.id = c.whatsapp_id limit 1)
) where user_id is null;

-- For any remaining conversations without user_id, check if users table exists and has rows
do $
begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants' and table_schema = 'public') then
    update public.conversations c
    set user_id = (select owner_id from public.tenants where tenants.id = c.tenant_id)
    where user_id is null;
  end if;
end ;

alter table public.conversations alter column user_id set not null;

-- Set user_id for ai_settings
update public.ai_settings a
set user_id = coalesce(
  (select user_id from public.connected_pages where connected_pages.id = a.page_id limit 1),
  (select user_id from public.instagram_accounts where instagram_accounts.id = a.instagram_id limit 1)
) where user_id is null;

do $
begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants' and table_schema = 'public') then
    update public.ai_settings a
    set user_id = (select owner_id from public.tenants where tenants.id = a.tenant_id)
    where user_id is null;
  end if;
end ;

alter table public.ai_settings alter column user_id set not null;

-- Set user_id for knowledge_base
do $
begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants' and table_schema = 'public') then
    update public.knowledge_base kb set user_id = (select owner_id from public.tenants where tenants.id = kb.tenant_id) where user_id is null;
  end if;
end ;

alter table public.knowledge_base alter column user_id set not null;

-- Set user_id for orders
do $
begin
  if exists (select 1 from information_schema.tables where table_name = 'tenants' and table_schema = 'public') then
    update public.orders o set user_id = (select owner_id from public.tenants where tenants.id = o.tenant_id) where user_id is null;
  end if;
end ;

alter table public.orders alter column user_id set not null;

-- Ensure drop of tenants (in case still exists)
drop table if exists public.tenants;

-- Ensure RPCs are updated
drop function if exists public.get_user_tenant_id();

create or replace function public.handle_new_user()
returns trigger as $
begin
  insert into public.users (id, email, full_name, username, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end; $;
 language plpgsql security definer;

drop function if exists public.get_dashboard_stats(uuid);
create function public.get_dashboard_stats(p_user_id uuid)
returns table (
  total_pages bigint, total_instagram bigint, total_whatsapp bigint,
  total_conversations bigint, total_messages bigint, ai_replies_today bigint,
  quota_used integer, quota_daily integer
) as $
begin
  return query
  select
    (select count(*) from public.connected_pages where user_id = p_user_id and is_active = true),
    (select count(*) from public.instagram_accounts where user_id = p_user_id and is_active = true),
    (select count(*) from public.whatsapp_accounts where user_id = p_user_id and is_active = true),
    (select count(*) from public.conversations where user_id = p_user_id and is_archived = false),
    (select count(*) from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where c.user_id = p_user_id),
    (select count(*) from public.usage_logs
      where user_id = p_user_id and action = 'ai_reply' and created_at >= current_date),
    (select u.ai_quota_used from public.users u where u.id = p_user_id),
    (select u.ai_quota_daily from public.users u where u.id = p_user_id);
end; $;
 language plpgsql stable;

drop function if exists public.get_platform_stats();
create function public.get_platform_stats()
returns table (
  total_users bigint, total_pages bigint, total_instagram bigint,
  total_conversations bigint, total_messages bigint,
  ai_replies_total bigint, ai_replies_today bigint, total_tokens_used bigint
) as $
begin
  return query
  select
    (select count(*) from public.users),
    (select count(*) from public.connected_pages where is_active = true),
    (select count(*) from public.instagram_accounts where is_active = true),
    (select count(*) from public.conversations where is_archived = false),
    (select count(*) from public.messages),
    (select count(*) from public.usage_logs where action = 'ai_reply'),
    (select count(*) from public.usage_logs where action = 'ai_reply' and created_at >= current_date),
    (select coalesce(sum(tokens_used), 0) from public.usage_logs);
end; $;
 language plpgsql stable security definer;

-- Ensure new RLS policies exist (drop old first)
drop policy if exists "Pages access for tenant owner" on public.connected_pages;
drop policy if exists "Instagram accounts access for tenant owner" on public.instagram_accounts;
drop policy if exists "Conversations access for tenant owner" on public.conversations;
drop policy if exists "Messages access for tenant owner" on public.messages;
drop policy if exists "Messages insert for tenant owner" on public.messages;
drop policy if exists "Knowledge base access for tenant owner" on public.knowledge_base;
drop policy if exists "AI settings access for tenant owner" on public.ai_settings;
drop policy if exists "Usage logs access for tenant owner" on public.usage_logs;
drop policy if exists "Orders access for tenant owner" on public.orders;
drop policy if exists "WhatsApp accounts access for tenant owner" on public.whatsapp_accounts;
drop policy if exists "Admins can read all tenants" on public.tenants;
drop policy if exists "Admins can update tenants" on public.tenants;
drop policy if exists "Tenant access for owner" on public.tenants;

create policy "Users can access own connected pages"
  on public.connected_pages for all using (user_id = auth.uid());
create policy "Users can access own instagram accounts"
  on public.instagram_accounts for all using (user_id = auth.uid());
create policy "Users can access own whatsapp accounts"
  on public.whatsapp_accounts for all using (user_id = auth.uid());
create policy "Users can access own conversations"
  on public.conversations for all using (user_id = auth.uid());
create policy "Messages select for own conversations"
  on public.messages for select using (
    exists (select 1 from public.conversations where conversations.id = messages.conversation_id and conversations.user_id = auth.uid())
  );
create policy "Messages insert for own conversations"
  on public.messages for insert with check (
    exists (select 1 from public.conversations where conversations.id = conversation_id and conversations.user_id = auth.uid())
  );
create policy "Users can access own knowledge base"
  on public.knowledge_base for all using (user_id = auth.uid());
create policy "Users can access own ai settings"
  on public.ai_settings for all using (user_id = auth.uid());
create policy "Users can view own usage logs"
  on public.usage_logs for select using (user_id = auth.uid());
create policy "Users can access own orders"
  on public.orders for all using (user_id = auth.uid());
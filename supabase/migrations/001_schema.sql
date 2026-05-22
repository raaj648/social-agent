-- ============================================================
-- SocialReply AI - Complete Database Schema
-- Supabase PostgreSQL migration
-- ============================================================

-- 0. Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 1. Users (extends Supabase auth.users)
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  plan          text not null default 'free' check (plan in ('free', 'starter', 'pro', 'enterprise')),
  ai_quota_daily integer not null default 100,
  ai_quota_used  integer not null default 0,
  quota_reset_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id);

-- 2. Tenants (organization/workspace)
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.users(id) on delete cascade,
  name          text not null,
  slug          text unique not null,
  settings      jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.tenants enable row level security;

create policy "Tenant access for owner"
  on public.tenants for all
  using (owner_id = auth.uid());

-- 3. Connected Facebook Pages
create table if not exists public.connected_pages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  page_id         text not null,
  page_name       text not null,
  page_access_token text not null, -- encrypted at application layer
  page_category   text,
  picture_url     text,
  subscribed      boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(tenant_id, page_id)
);

create index idx_connected_pages_tenant on public.connected_pages(tenant_id);
create index idx_connected_pages_page on public.connected_pages(page_id);

alter table public.connected_pages enable row level security;

create policy "Pages access for tenant owner"
  on public.connected_pages for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = connected_pages.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- 4. Instagram Business Accounts
create table if not exists public.instagram_accounts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  page_id             uuid references public.connected_pages(id) on delete set null,
  ig_account_id       text not null,
  ig_username         text not null,
  ig_name             text,
  ig_profile_pic      text,
  ig_access_token     text not null, -- encrypted at application layer
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(tenant_id, ig_account_id)
);

create index idx_instagram_accounts_tenant on public.instagram_accounts(tenant_id);

alter table public.instagram_accounts enable row level security;

create policy "Instagram accounts access for tenant owner"
  on public.instagram_accounts for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = instagram_accounts.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- 5. Conversations
create table if not exists public.conversations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  page_id           uuid references public.connected_pages(id) on delete set null,
  instagram_id      uuid references public.instagram_accounts(id) on delete set null,
  platform          text not null check (platform in ('messenger', 'instagram')),
  sender_id         text not null,
  sender_name       text,
  sender_picture    text,
  last_message_at   timestamptz not null default now(),
  unread_count      integer not null default 0,
  is_archived       boolean not null default false,
  ai_enabled        boolean not null default true,
  metadata          jsonb default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_conversations_tenant on public.conversations(tenant_id);
create index idx_conversations_sender on public.conversations(sender_id);
create index idx_conversations_platform on public.conversations(platform);
create index idx_conversations_last_message on public.conversations(last_message_at desc);

alter table public.conversations enable row level security;

create policy "Conversations access for tenant owner"
  on public.conversations for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = conversations.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- 6. Messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  platform_msg_id text,
  is_read         boolean not null default false,
  sent_via_ai     boolean not null default false,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation on public.messages(conversation_id);
create index idx_messages_created on public.messages(created_at);

alter table public.messages enable row level security;

create policy "Messages access for tenant owner"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      join public.tenants on tenants.id = conversations.tenant_id
      where conversations.id = messages.conversation_id
      and tenants.owner_id = auth.uid()
    )
  );

create policy "Messages insert for tenant owner"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      join public.tenants on tenants.id = conversations.tenant_id
      where conversations.id = conversation_id
      and tenants.owner_id = auth.uid()
    )
  );

-- 7. Knowledge Base
create table if not exists public.knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  category    text not null default 'general' check (category in ('general', 'faq', 'pricing', 'delivery', 'products', 'policy', 'custom')),
  title       text not null,
  content     text not null,
  tags        text[] default '{}',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_knowledge_base_tenant on public.knowledge_base(tenant_id);
create index idx_knowledge_base_category on public.knowledge_base(category);

alter table public.knowledge_base enable row level security;

create policy "Knowledge base access for tenant owner"
  on public.knowledge_base for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = knowledge_base.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- 8. AI Settings
create table if not exists public.ai_settings (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  page_id               uuid references public.connected_pages(id) on delete cascade,
  instagram_id          uuid references public.instagram_accounts(id) on delete cascade,
  model                 text not null default 'openai/gpt-3.5-turbo',
  system_prompt         text,
  temperature           numeric(3,2) not null default 0.7,
  max_tokens            integer not null default 500,
  fallback_response     text not null default 'Thanks for your message! We will get back to you shortly.',
  greeting_enabled      boolean not null default true,
  greeting_message      text default 'Hello! How can we help you today?',
  business_hours_only   boolean not null default false,
  business_hours_start  time default '09:00',
  business_hours_end    time default '18:00',
  timezone              text default 'Asia/Dhaka',
  keywords_blacklist    text[] default '{}',
  conversation_memory_count integer not null default 10,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(tenant_id, coalesce(page_id, '00000000-0000-0000-0000-000000000000'), coalesce(instagram_id, '00000000-0000-0000-0000-000000000000'))
);

alter table public.ai_settings enable row level security;

create policy "AI settings access for tenant owner"
  on public.ai_settings for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = ai_settings.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- 9. Usage Logs
create table if not exists public.usage_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  page_id         uuid references public.connected_pages(id) on delete set null,
  action          text not null check (action in ('ai_reply', 'webhook_received', 'message_sent', 'login', 'page_connect', 'instagram_connect', 'knowledge_update')),
  platform        text check (platform in ('messenger', 'instagram')),
  tokens_used     integer default 0,
  model_used      text,
  metadata        jsonb default '{}'::jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

create index idx_usage_logs_tenant on public.usage_logs(tenant_id);
create index idx_usage_logs_user on public.usage_logs(user_id);
create index idx_usage_logs_action on public.usage_logs(action);
create index idx_usage_logs_created on public.usage_logs(created_at);

alter table public.usage_logs enable row level security;

create policy "Usage logs access for tenant owner"
  on public.usage_logs for select
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = usage_logs.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create user record on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Auto-create tenant for the new user
  insert into public.tenants (owner_id, name, slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email) || '''s Workspace',
    lower(replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), ' ', '-')) || '-' || substr(md5(new.id::text), 1, 8)
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update updated_at on row change
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute procedure public.update_updated_at();

create trigger tenants_updated_at before update on public.tenants
  for each row execute procedure public.update_updated_at();

create trigger connected_pages_updated_at before update on public.connected_pages
  for each row execute procedure public.update_updated_at();

create trigger instagram_accounts_updated_at before update on public.instagram_accounts
  for each row execute procedure public.update_updated_at();

create trigger conversations_updated_at before update on public.conversations
  for each row execute procedure public.update_updated_at();

create trigger knowledge_base_updated_at before update on public.knowledge_base
  for each row execute procedure public.update_updated_at();

-- Daily quota reset function
create or replace function public.reset_daily_quotas()
returns void as $$
begin
  update public.users
  set
    ai_quota_used = 0,
    quota_reset_at = date_trunc('day', now()) + interval '1 day'
  where quota_reset_at < now();
end;
$$ language plpgsql;

-- ============================================================
-- RLS POLICY HELPER
-- ============================================================

-- Allow users to see their own tenant_id for use in application
create or replace function public.get_user_tenant_id()
returns uuid as $$
  select id from public.tenants where owner_id = auth.uid() limit 1;
$$ language sql stable;

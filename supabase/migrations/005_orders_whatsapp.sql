-- WhatsApp Business Accounts
create table if not exists public.whatsapp_accounts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  phone_number_id text not null,
  phone_number    text not null,
  business_name   text,
  waba_id         text,
  access_token    text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(tenant_id, phone_number_id)
);

create index idx_whatsapp_accounts_tenant on public.whatsapp_accounts(tenant_id);

alter table public.whatsapp_accounts enable row level security;

create policy "WhatsApp accounts access for tenant owner"
  on public.whatsapp_accounts for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = whatsapp_accounts.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- Add WhatsApp to conversations platform check
alter table public.conversations
  drop constraint if exists conversations_platform_check;
alter table public.conversations
  add constraint conversations_platform_check
  check (platform in ('messenger', 'instagram', 'whatsapp'));

-- Add whatsapp_id to conversations
alter table public.conversations
  add column if not exists whatsapp_id uuid references public.whatsapp_accounts(id) on delete set null;

-- Orders table (for AI-extracted orders)
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_name   text,
  phone           text,
  delivery_address text,
  product_details text not null default '',
  status          text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  source          text not null default 'direct_chat' check (source in ('direct_chat', 'website', 'form')),
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_orders_tenant on public.orders(tenant_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_created on public.orders(created_at desc);

alter table public.orders enable row level security;

create policy "Orders access for tenant owner"
  on public.orders for all
  using (
    exists (
      select 1 from public.tenants
      where tenants.id = orders.tenant_id
      and tenants.owner_id = auth.uid()
    )
  );

-- Add order method fields to tenants
alter table public.tenants
  add column if not exists order_method text not null default 'direct_chat' check (order_method in ('website', 'form', 'direct_chat'));

alter table public.tenants
  add column if not exists order_link text;

alter table public.tenants
  add column if not exists system_prompt text;

-- Add last_interaction to conversations for 24-hour window tracking
alter table public.conversations
  add column if not exists last_interaction timestamptz not null default now();

-- Add is_ai_paused to conversations 
-- (already has ai_enabled, but let's add the explicit field the blueprint uses)
alter table public.conversations
  add column if not exists is_ai_paused boolean not null default false;

-- PlatformSettings single-row table (as blueprint specifies)
create table if not exists public.platform_config (
  id                text primary key default 'global',
  open_router_api_key text,
  default_ai_model  text not null default 'openai/gpt-4o-mini',
  updated_at        timestamptz not null default now()
);

alter table public.platform_config enable row level security;

create policy "Admins can read platform_config"
  on public.platform_config for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can insert platform_config"
  on public.platform_config for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can update platform_config"
  on public.platform_config for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

insert into public.platform_config (id, default_ai_model) values ('global', 'openai/gpt-4o-mini')
on conflict (id) do nothing;

-- Updated_at triggers
create trigger whatsapp_accounts_updated_at before update on public.whatsapp_accounts
  for each row execute procedure public.update_updated_at();

create trigger orders_updated_at before update on public.orders
  for each row execute procedure public.update_updated_at();

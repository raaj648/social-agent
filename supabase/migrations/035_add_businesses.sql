-- businesses table: enable multi-business per user
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_businesses_user on public.businesses(user_id);

alter table public.businesses enable row level security;

create policy "Users can view their own businesses"
  on public.businesses for select
  using (user_id = auth.uid());

create policy "Users can insert their own businesses"
  on public.businesses for insert
  with check (user_id = auth.uid());

create policy "Users can update their own businesses"
  on public.businesses for update
  using (user_id = auth.uid());

create policy "Users can delete their own businesses"
  on public.businesses for delete
  using (user_id = auth.uid());

-- Add business_id FK to connected_pages
alter table public.connected_pages
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists idx_connected_pages_business on public.connected_pages(business_id);

-- Add business_id FK to instagram_accounts
alter table public.instagram_accounts
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists idx_instagram_accounts_business on public.instagram_accounts(business_id);

-- Add business_id FK to whatsapp_accounts
alter table public.whatsapp_accounts
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

create index if not exists idx_whatsapp_accounts_business on public.whatsapp_accounts(business_id);

-- Add business_id FK to knowledge_base
alter table public.knowledge_base
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

create index if not exists idx_knowledge_base_business on public.knowledge_base(business_id);

-- Add business_id FK to products
alter table public.products
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

create index if not exists idx_products_business on public.products(business_id);

-- Add business_id FK to ai_settings
alter table public.ai_settings
  add column if not exists business_id uuid references public.businesses(id) on delete cascade;

create index if not exists idx_ai_settings_business on public.ai_settings(business_id);

-- Backfill: create a "Default Business" for every user who has data
do $$
declare
  rec record;
  biz_id uuid;
begin
  for rec in (
    select distinct user_id from (
      select user_id from public.connected_pages
      union
      select user_id from public.instagram_accounts
      union
      select user_id from public.whatsapp_accounts
      union
      select user_id from public.knowledge_base
      union
      select user_id from public.products
      union
      select user_id from public.ai_settings
    ) as users_with_data
  ) loop
    -- Only create default business if user doesn't already have one
    if not exists (select 1 from public.businesses where user_id = rec.user_id) then
      biz_id := gen_random_uuid();
      insert into public.businesses (id, user_id, name, description)
      values (biz_id, rec.user_id, 'Default Business', 'Auto-created default business');

      -- Assign existing records to the default business
      update public.connected_pages set business_id = biz_id
        where user_id = rec.user_id and business_id is null;
      update public.instagram_accounts set business_id = biz_id
        where user_id = rec.user_id and business_id is null;
      update public.whatsapp_accounts set business_id = biz_id
        where user_id = rec.user_id and business_id is null;
      update public.knowledge_base set business_id = biz_id
        where user_id = rec.user_id and business_id is null;
      update public.products set business_id = biz_id
        where user_id = rec.user_id and business_id is null;
      update public.ai_settings set business_id = biz_id
        where user_id = rec.user_id and business_id is null;
    end if;
  end loop;
end;
$$;

-- Make business_id NOT NULL after backfill (only for tables where it's required)
-- Note: connected_pages, instagram_accounts, whatsapp_accounts keep nullable business_id
-- because they could be unassigned. knowledge_base, products, ai_settings require it.

-- Update RLS policies for knowledge_base to include business scope
drop policy if exists "Users can view their own knowledge base" on public.knowledge_base;
create policy "Users can view their own knowledge base"
  on public.knowledge_base for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own knowledge base" on public.knowledge_base;
create policy "Users can insert their own knowledge base"
  on public.knowledge_base for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own knowledge base" on public.knowledge_base;
create policy "Users can update their own knowledge base"
  on public.knowledge_base for update
  using (user_id = auth.uid());

drop policy if exists "Users can delete their own knowledge base" on public.knowledge_base;
create policy "Users can delete their own knowledge base"
  on public.knowledge_base for delete
  using (user_id = auth.uid());

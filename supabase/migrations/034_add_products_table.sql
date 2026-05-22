-- Products table: per-platform product catalog
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('messenger', 'instagram', 'whatsapp')),
  platform_ref_id uuid, -- NULL means all channels of this platform
  name text not null,
  description text,
  price numeric(10, 2),
  category text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_user_platform on public.products(user_id, platform);
create index if not exists idx_products_search on public.products using gin(to_tsvector('english', name || ' ' || coalesce(description, '')));

-- Enable RLS
alter table public.products enable row level security;

-- RLS: users can CRUD their own products
create policy "Users can view their own products"
  on public.products for select
  using (user_id = auth.uid());

create policy "Users can insert their own products"
  on public.products for insert
  with check (user_id = auth.uid());

create policy "Users can update their own products"
  on public.products for update
  using (user_id = auth.uid());

create policy "Users can delete their own products"
  on public.products for delete
  using (user_id = auth.uid());

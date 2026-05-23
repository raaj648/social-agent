-- Add telegram_id and discord_id to conversations (already in 036, but ensure)
alter table public.conversations
  add column if not exists telegram_id uuid,
  add column if not exists discord_id uuid;

-- Telegram bots table
create table if not exists public.telegram_bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  bot_token text not null,
  bot_username text,
  webhook_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_bots enable row level security;

create policy "Users can view own telegram bots"
  on public.telegram_bots for select
  using (auth.uid() = user_id);

create policy "Users can insert own telegram bots"
  on public.telegram_bots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own telegram bots"
  on public.telegram_bots for update
  using (auth.uid() = user_id);

create policy "Users can delete own telegram bots"
  on public.telegram_bots for delete
  using (auth.uid() = user_id);

-- Discord bots table
create table if not exists public.discord_bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  bot_token text not null,
  client_id text,
  guild_id text,
  channel_id text,
  bot_username text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discord_bots enable row level security;

create policy "Users can view own discord bots"
  on public.discord_bots for select
  using (auth.uid() = user_id);

create policy "Users can insert own discord bots"
  on public.discord_bots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own discord bots"
  on public.discord_bots for update
  using (auth.uid() = user_id);

create policy "Users can delete own discord bots"
  on public.discord_bots for delete
  using (auth.uid() = user_id);

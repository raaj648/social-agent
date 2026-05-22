-- Platform settings table for admin configuration
create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

-- Only admins can read/write platform settings
create policy "Admins can read platform settings"
  on public.platform_settings for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can insert platform settings"
  on public.platform_settings for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can update platform settings"
  on public.platform_settings for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Insert defaults
insert into public.platform_settings (key, value) values
  ('default_quota', '100'::jsonb),
  ('default_model', '"openai/gpt-3.5-turbo"'::jsonb),
  ('signups_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- Admin RPC: Get platform-wide stats
create or replace function public.get_platform_stats()
returns table (
  total_users bigint,
  total_tenants bigint,
  total_pages bigint,
  total_instagram bigint,
  total_conversations bigint,
  total_messages bigint,
  ai_replies_total bigint,
  ai_replies_today bigint,
  total_tokens_used bigint
) as $$
begin
  return query
  select
    (select count(*) from public.users),
    (select count(*) from public.tenants),
    (select count(*) from public.connected_pages where is_active = true),
    (select count(*) from public.instagram_accounts where is_active = true),
    (select count(*) from public.conversations where is_archived = false),
    (select count(*) from public.messages),
    (select count(*) from public.usage_logs where action = 'ai_reply'),
    (select count(*) from public.usage_logs where action = 'ai_reply' and created_at >= current_date),
    (select coalesce(sum(tokens_used), 0) from public.usage_logs);
end;
$$ language plpgsql stable security definer;

-- Daily registration stats
create or replace function public.get_daily_registrations(days integer default 7)
returns table (
  date date,
  count bigint
) as $$
begin
  return query
  select
    created_at::date as date,
    count(*)::bigint
  from public.users
  where created_at >= current_date - days
  group by created_at::date
  order by date;
end;
$$ language plpgsql stable security definer;

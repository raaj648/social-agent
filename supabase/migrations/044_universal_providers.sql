-- 044_universal_providers.sql
-- Add roles, google provider type, model_pricing, expand usage_logs

-- 1. ai_providers: add roles column
alter table public.ai_providers
add column roles jsonb not null default '["text"]'::jsonb
  check (roles <@ '["text", "vision", "voice"]'::jsonb);

-- 2. ai_providers: add google to provider_type check
alter table public.ai_providers drop constraint if exists ai_providers_provider_type_check;
alter table public.ai_providers add constraint ai_providers_provider_type_check
  check (provider_type in ('openrouter', 'deepseek', 'google', 'generic'));

-- 3. model_pricing table
create table if not exists public.model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  model_name text not null,
  input_price_per_1m_tokens numeric(10,6) not null default 0,
  output_price_per_1m_tokens numeric(10,6) not null default 0,
  is_auto_fetched boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(provider_id, model_name)
);

alter table public.model_pricing enable row level security;

create policy "Admins can manage model_pricing"
  on public.model_pricing for all
  using (public.is_admin());

-- 4. usage_logs: expand columns
alter table public.usage_logs
  add column if not exists provider_id uuid references public.ai_providers(id) on delete set null,
  add column if not exists model_name text,
  add column if not exists input_tokens integer default 0,
  add column if not exists output_tokens integer default 0,
  add column if not exists reasoning_tokens integer default 0,
  add column if not exists input_cost numeric(12,8) default 0,
  add column if not exists output_cost numeric(12,8) default 0,
  add column if not exists total_cost numeric(12,8) default 0,
  add column if not exists points_charged integer default 0,
  add column if not exists action_type text check (action_type in ('text_reply', 'image_read', 'voice_read'));

create index if not exists idx_usage_logs_provider on public.usage_logs(provider_id);
create index if not exists idx_usage_logs_action_type on public.usage_logs(action_type);
create index if not exists idx_usage_logs_cost on public.usage_logs(created_at, total_cost);

-- 5. Update action check constraint to include new columns
alter table public.usage_logs
  drop constraint if exists usage_logs_action_check;

alter table public.usage_logs
  add constraint usage_logs_action_check
  check (action in ('ai_reply', 'webhook_received', 'message_sent', 'login', 'page_connect', 'instagram_connect', 'knowledge_update', 'image_read', 'voice_read'));

-- 6. Drop old tenant_id constraint if exists (cleanup from previous migrations)
alter table public.usage_logs drop constraint if exists usage_logs_tenant_id_fkey;

-- 7. RPC for admin financial summary
create or replace function public.get_admin_financial_summary()
returns jsonb
language plpgsql security definer
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_cost', coalesce(sum(total_cost), 0),
    'total_points_charged', coalesce(sum(points_charged), 0),
    'total_input_tokens', coalesce(sum(input_tokens), 0),
    'total_output_tokens', coalesce(sum(output_tokens), 0),
    'total_reasoning_tokens', coalesce(sum(reasoning_tokens), 0),
    'total_calls', count(*)
  ) into result
  from public.usage_logs
  where created_at >= now() - interval '30 days';
  return result;
end;
$$;

-- AI Providers (multi-provider support for Owner Admin Panel)
create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  api_key text not null,        -- encrypted with AES-256-GCM at application layer
  default_model text not null default 'gpt-4o-mini',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_providers enable row level security;

create policy "Admins can manage ai_providers"
  on public.ai_providers for all
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create trigger ai_providers_updated_at before update on public.ai_providers
  for each row execute procedure public.update_updated_at();

-- Master prompt (system-wide, injected before every AI system prompt)
alter table public.platform_config
  add column if not exists master_prompt text;

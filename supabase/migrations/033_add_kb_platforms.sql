-- Junction table: knowledge_base <-> platforms (many-to-many)
create table if not exists public.knowledge_base_platforms (
  id uuid primary key default gen_random_uuid(),
  kb_id uuid not null references public.knowledge_base(id) on delete cascade,
  platform text not null check (platform in ('messenger', 'instagram', 'whatsapp')),
  platform_ref_id uuid, -- NULL means all channels of this platform
  created_at timestamptz not null default now(),
  unique(kb_id, platform, coalesce(platform_ref_id, '00000000-0000-0000-0000-000000000000'))
);

-- Migrate existing data: for each KB item with a specific platform
insert into public.knowledge_base_platforms (kb_id, platform, platform_ref_id)
select id, platform, platform_ref_id
from public.knowledge_base
where platform is not null and platform != 'all' and platform in ('messenger', 'instagram', 'whatsapp');

-- Migrate existing data: for each KB item with platform = 'all', insert one row per platform
insert into public.knowledge_base_platforms (kb_id, platform, platform_ref_id)
select id, unnest(array['messenger', 'instagram', 'whatsapp']), null
from public.knowledge_base
where platform = 'all';

-- Enable RLS
alter table public.knowledge_base_platforms enable row level security;

-- RLS: users can only access their own KB platforms through the KB relation
create policy "Users can manage their own KB platforms"
  on public.knowledge_base_platforms
  using (
    exists (
      select 1 from public.knowledge_base
      where knowledge_base.id = knowledge_base_platforms.kb_id
      and knowledge_base.user_id = auth.uid()
    )
  );

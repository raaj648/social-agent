-- ============================================================
-- Migration 031: Platform-specific knowledge base + human support
-- ============================================================

-- 1. Knowledge Base: add platform scoping columns
alter table public.knowledge_base
  add column if not exists platform text
  check (platform in ('messenger', 'instagram', 'whatsapp', 'all'));

alter table public.knowledge_base
  add column if not exists platform_ref_id uuid;

-- 2. Conversations: add human support columns
alter table public.conversations
  add column if not exists is_urgent boolean not null default false;

alter table public.conversations
  add column if not exists requested_human_at timestamptz;

-- 3. AI Settings: add agent config columns
alter table public.ai_settings
  add column if not exists agent_display_name text not null default 'Support Agent';

alter table public.ai_settings
  add column if not exists ai_agent_name text not null default 'AI Assistant';

alter table public.ai_settings
  add column if not exists human_handoff_enabled boolean not null default true;

alter table public.ai_settings
  add column if not exists human_handoff_message text not null default '{agent_name} has joined the chat';

alter table public.ai_settings
  add column if not exists show_handoff_on_pause boolean not null default false;

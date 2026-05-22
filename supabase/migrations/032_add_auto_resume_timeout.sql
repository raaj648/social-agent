-- ============================================================
-- Migration 032: Auto-resume timeout + configurable business name & agent role
-- ============================================================

-- 1. AI Settings: add auto_resume_minutes column
alter table public.ai_settings
  add column if not exists auto_resume_minutes int4;

-- 2. AI Settings: add business_name column (auto-detected, user-editable)
alter table public.ai_settings
  add column if not exists business_name text;

-- 3. AI Settings: add agent_role column with default 'Sales Agent'
alter table public.ai_settings
  add column if not exists agent_role text not null default 'Sales Agent';

-- 4. Update any existing rows that had the old default to 'Sales Agent'
update public.ai_settings set agent_role = 'Sales Agent' where agent_role in ('General', 'Virtual Assistant');

-- 5. Conversations: add auto_resume_at timestamp
alter table public.conversations
  add column if not exists auto_resume_at timestamptz;

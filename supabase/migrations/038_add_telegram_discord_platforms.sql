-- ============================================================
-- Migration 038: Add Telegram and Discord to platform CHECK constraints
-- ============================================================

-- 1. conversations: add 'telegram', 'discord'
alter table public.conversations
  drop constraint if exists conversations_platform_check;
alter table public.conversations
  add constraint conversations_platform_check
  check (platform in ('messenger', 'instagram', 'whatsapp', 'telegram', 'discord'));

-- 2. usage_logs: add 'telegram', 'discord' to platform check
alter table public.usage_logs
  drop constraint if exists usage_logs_platform_check;
alter table public.usage_logs
  add constraint usage_logs_platform_check
  check (platform in ('messenger', 'instagram', 'whatsapp', 'telegram', 'discord'));

-- 3. usage_logs: add telegram/discord actions to action check
alter table public.usage_logs
  drop constraint if exists usage_logs_action_check;
alter table public.usage_logs
  add constraint usage_logs_action_check
  check (action in (
    'ai_reply', 'webhook_received', 'message_sent',
    'login', 'page_connect', 'instagram_connect', 'whatsapp_connect',
    'telegram_connect', 'telegram_disconnect',
    'discord_connect', 'discord_disconnect',
    'knowledge_update'
  ));

-- 4. products: add 'telegram', 'discord'
alter table public.products
  drop constraint if exists products_platform_check;
alter table public.products
  add constraint products_platform_check
  check (platform in ('messenger', 'instagram', 'whatsapp', 'telegram', 'discord'));

-- 6. knowledge_base: add 'telegram', 'discord'
alter table public.knowledge_base
  drop constraint if exists knowledge_base_platform_check;
alter table public.knowledge_base
  add constraint knowledge_base_platform_check
  check (platform in ('messenger', 'instagram', 'whatsapp', 'telegram', 'discord', 'all'));

-- Add fb_user_access_token to users table for storing long-lived Facebook user token
alter table public.users
  add column if not exists fb_user_access_token text;

-- Add telegram_id and discord_id to conversations
alter table public.conversations
  add column if not exists telegram_id uuid,
  add column if not exists discord_id uuid;

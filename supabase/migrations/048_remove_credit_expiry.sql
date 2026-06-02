-- Migration 048: Remove credit expiry (prepaid model — credits never expire)

-- 1. Drop credits_expires_at column from users
alter table public.users drop column if exists credits_expires_at;

-- 2. Remove the platform setting
delete from public.platform_settings where key = 'default_credits_expiry_days';

-- 3. Update handle_new_user to remove expiry logic
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  free_credits integer;
begin
  select coalesce((select (value#>>'{}')::integer from public.platform_settings where key = 'default_free_credits'), 50) into free_credits;

  insert into public.users (id, email, full_name, avatar_url, user_number, credits_remaining, credits_total)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    nextval('public.user_number_seq'),
    free_credits,
    free_credits
  );
  return new;
end;
$$;

-- 4. Update get_dashboard_stats to remove credits_expires_at
drop function if exists public.get_dashboard_stats(uuid);

create function public.get_dashboard_stats(p_user_id uuid)
returns table (
  total_pages bigint, total_instagram bigint, total_whatsapp bigint,
  total_conversations bigint, total_messages bigint, ai_replies_today bigint,
  credits_remaining integer, credits_total integer
)
language plpgsql
stable
security definer
as $$
begin
  return query
  select
    (select count(*) from public.connected_pages where user_id = p_user_id and is_active = true),
    (select count(*) from public.instagram_accounts where user_id = p_user_id and is_active = true),
    (select count(*) from public.whatsapp_accounts where user_id = p_user_id and is_active = true),
    (select count(*) from public.conversations where user_id = p_user_id and is_archived = false),
    (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where c.user_id = p_user_id),
    (select count(*) from public.usage_logs where user_id = p_user_id and action = 'ai_reply' and created_at >= current_date),
    (select u.credits_remaining from public.users u where u.id = p_user_id),
    (select u.credits_total from public.users u where u.id = p_user_id);
end;
$$;

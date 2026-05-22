-- Monthly credit system, remove daily quota

-- 1. Add credit columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_remaining integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_total integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS credits_expires_at timestamptz;

-- 2. Backfill existing users
UPDATE public.users SET credits_remaining = 100, credits_total = 100 WHERE credits_remaining = 0 AND EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = users.id);

-- 3. Drop old daily quota columns
ALTER TABLE public.users DROP COLUMN IF EXISTS ai_quota_daily;
ALTER TABLE public.users DROP COLUMN IF EXISTS ai_quota_used;
ALTER TABLE public.users DROP COLUMN IF EXISTS quota_reset_at;

-- 4. Add default platform settings for credits
INSERT INTO public.platform_settings (key, value) VALUES
  ('default_free_credits', '50'::jsonb),
  ('default_credits_expiry_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Update handle_new_user to use credit defaults from platform_settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  free_credits integer;
  expiry_days integer;
BEGIN
  SELECT COALESCE((SELECT (value#>>'{}')::integer FROM public.platform_settings WHERE key = 'default_free_credits'), 50) INTO free_credits;
  SELECT COALESCE((SELECT (value#>>'{}')::integer FROM public.platform_settings WHERE key = 'default_credits_expiry_days'), 30) INTO expiry_days;

  INSERT INTO public.users (id, email, full_name, avatar_url, user_number, credits_remaining, credits_total, credits_expires_at)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    nextval('public.user_number_seq'),
    free_credits,
    free_credits,
    CASE WHEN expiry_days > 0 THEN now() + (expiry_days || ' days')::interval ELSE NULL END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update increment_usage RPC to decrement credits
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id uuid, p_tokens integer DEFAULT 0)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET credits_remaining = GREATEST(credits_remaining - 1, 0), updated_at = now()
  WHERE id = p_user_id AND credits_remaining > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update get_dashboard_stats to return credits instead of daily quota
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);
CREATE FUNCTION public.get_dashboard_stats(p_user_id uuid)
RETURNS table (
  total_pages bigint, total_instagram bigint, total_whatsapp bigint,
  total_conversations bigint, total_messages bigint, ai_replies_today bigint,
  credits_remaining integer, credits_total integer, credits_expires_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.connected_pages WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM public.instagram_accounts WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM public.whatsapp_accounts WHERE user_id = p_user_id AND is_active = true),
    (SELECT COUNT(*) FROM public.conversations WHERE user_id = p_user_id AND is_archived = false),
    (SELECT COUNT(*) FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id WHERE c.user_id = p_user_id),
    (SELECT COUNT(*) FROM public.usage_logs WHERE user_id = p_user_id AND action = 'ai_reply' AND created_at >= current_date),
    (SELECT u.credits_remaining FROM public.users u WHERE u.id = p_user_id),
    (SELECT u.credits_total FROM public.users u WHERE u.id = p_user_id),
    (SELECT u.credits_expires_at FROM public.users u WHERE u.id = p_user_id);
END;
$$ LANGUAGE plpgsql STABLE;

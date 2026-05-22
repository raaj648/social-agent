-- Fix RLS recursion: replace inline admin checks with security definer is_admin()
-- Also add SECURITY DEFINER to get_dashboard_stats

-- 1. Drop recursive policies on users table
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;

-- 2. Recreate SELECT policy using is_admin() security definer RPC
CREATE POLICY "Users can read own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- 3. Recreate UPDATE policy using is_admin()
CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  USING (public.is_admin());

-- 4. Fix policies on other tables that query users recursively
DROP POLICY IF EXISTS "Admins can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can insert platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;

CREATE POLICY "Admins can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage platform_config" ON public.platform_config;
CREATE POLICY "Admins can manage platform_config"
  ON public.platform_config FOR ALL
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage ai_providers" ON public.ai_providers;
CREATE POLICY "Admins can manage ai_providers"
  ON public.ai_providers FOR ALL
  USING (public.is_admin());

-- 5. Add SECURITY DEFINER to get_dashboard_stats to avoid recursive RLS on its users subqueries
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- Migration 021: Cleanup redundant tables, fix FK constraints
-- ============================================================

-- 1. Drop redundant platform_config table, merge into platform_settings
-- First migrate any data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_config' AND table_schema = 'public') THEN
    -- Transfer master_prompt to platform_settings
    INSERT INTO public.platform_settings (key, value)
    SELECT 'master_prompt', to_jsonb(coalesce(master_prompt, ''))
    FROM public.platform_config
    WHERE id = 'global' AND master_prompt IS NOT NULL AND master_prompt != ''
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

    -- Transfer default_ai_model to platform_settings if not already set
    INSERT INTO public.platform_settings (key, value)
    SELECT 'default_model', to_jsonb(default_ai_model)
    FROM public.platform_config
    WHERE id = 'global'
    ON CONFLICT (key) DO NOTHING;

    DROP TABLE IF EXISTS public.platform_config CASCADE;
  END IF;
END $$;

-- 2. Add FK constraint for usage_logs.user_id → users.id
-- Only add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'usage_logs_user_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'usage_logs'
  ) THEN
    ALTER TABLE public.usage_logs
      ADD CONSTRAINT usage_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Ensure FK for connected_pages.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'connected_pages_user_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'connected_pages'
  ) THEN
    ALTER TABLE public.connected_pages
      ADD CONSTRAINT connected_pages_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Ensure FK for instagram_accounts.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'instagram_accounts_user_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'instagram_accounts'
  ) THEN
    ALTER TABLE public.instagram_accounts
      ADD CONSTRAINT instagram_accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Ensure FK for whatsapp_accounts.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'whatsapp_accounts_user_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'whatsapp_accounts'
  ) THEN
    ALTER TABLE public.whatsapp_accounts
      ADD CONSTRAINT whatsapp_accounts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Ensure FK for knowledge_base.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'knowledge_base_user_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'knowledge_base'
  ) THEN
    ALTER TABLE public.knowledge_base
      ADD CONSTRAINT knowledge_base_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. Ensure FK for orders.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_user_id_fkey'
    AND table_schema = 'public'
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. Recreate increment_usage with proper error handling and dedup protection
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id uuid, p_tokens integer DEFAULT 0)
RETURNS void AS $$
DECLARE
  rows_affected integer;
BEGIN
  UPDATE public.users
  SET credits_remaining = GREATEST(credits_remaining - 1, 0),
      updated_at = now()
  WHERE id = p_user_id AND credits_remaining > 0;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE WARNING 'increment_usage: No rows affected for user % — credits may be 0 or user missing', p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Recreate get_dashboard_stats with SECURITY DEFINER (ensure latest version)
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

-- 10. Recreate get_platform_stats with SECURITY DEFINER
DROP FUNCTION IF EXISTS public.get_platform_stats();
CREATE FUNCTION public.get_platform_stats()
RETURNS table (
  total_users bigint, total_pages bigint, total_instagram bigint,
  total_conversations bigint, total_messages bigint,
  ai_replies_total bigint, ai_replies_today bigint, total_tokens_used bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.users),
    (SELECT COUNT(*) FROM public.connected_pages WHERE is_active = true),
    (SELECT COUNT(*) FROM public.instagram_accounts WHERE is_active = true),
    (SELECT COUNT(*) FROM public.conversations WHERE is_archived = false),
    (SELECT COUNT(*) FROM public.messages),
    (SELECT COUNT(*) FROM public.usage_logs WHERE action = 'ai_reply'),
    (SELECT COUNT(*) FROM public.usage_logs WHERE action = 'ai_reply' AND created_at >= current_date),
    (SELECT COALESCE(SUM(tokens_used), 0) FROM public.usage_logs);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 11. Fix announce policies to use is_admin()
DROP POLICY IF EXISTS "Admins can read announcement_templates" ON public.announcement_templates;
DROP POLICY IF EXISTS "Admins can insert announcement_templates" ON public.announcement_templates;
DROP POLICY IF EXISTS "Admins can update announcement_templates" ON public.announcement_templates;
DROP POLICY IF EXISTS "Admins can delete announcement_templates" ON public.announcement_templates;
DROP POLICY IF EXISTS "Admins can read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;

-- Recreate without recursive RLS
CREATE POLICY "Admins can read announcement_templates"
  ON public.announcement_templates FOR SELECT
  USING (public.is_admin());
CREATE POLICY "Admins can insert announcement_templates"
  ON public.announcement_templates FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update announcement_templates"
  ON public.announcement_templates FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "Admins can delete announcement_templates"
  ON public.announcement_templates FOR DELETE
  USING (public.is_admin());
CREATE POLICY "Admins can read announcements"
  ON public.announcements FOR SELECT
  USING (public.is_admin());
CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (public.is_admin());

-- 12. Fix billing_plans policies to use is_admin()
DROP POLICY IF EXISTS "Admins can insert billing_plans" ON public.billing_plans;
DROP POLICY IF EXISTS "Admins can update billing_plans" ON public.billing_plans;
DROP POLICY IF EXISTS "Admins can delete billing_plans" ON public.billing_plans;

CREATE POLICY "Admins can insert billing_plans"
  ON public.billing_plans FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update billing_plans"
  ON public.billing_plans FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "Admins can delete billing_plans"
  ON public.billing_plans FOR DELETE
  USING (public.is_admin());

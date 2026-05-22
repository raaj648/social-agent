-- 023_add_missing_insert_policies.sql
-- Add INSERT RLS policies for tables the webhook and users write to.
-- Existing ALL policies lacked WITH CHECK, which silently blocks INSERT
-- for anon-key clients. Only messages had a proper INSERT policy.

-- usage_logs
DROP POLICY IF EXISTS "Users can insert own usage logs" ON public.usage_logs;
CREATE POLICY "Users can insert own usage logs"
  ON public.usage_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- conversations
DROP POLICY IF EXISTS users_insert_own_conversations ON public.conversations;
CREATE POLICY users_insert_own_conversations
  ON public.conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- orders
DROP POLICY IF EXISTS users_insert_own_orders ON public.orders;
CREATE POLICY users_insert_own_orders
  ON public.orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- connected_pages
DROP POLICY IF EXISTS users_insert_own_connected_pages ON public.connected_pages;
CREATE POLICY users_insert_own_connected_pages
  ON public.connected_pages FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- instagram_accounts
DROP POLICY IF EXISTS users_insert_own_instagram ON public.instagram_accounts;
CREATE POLICY users_insert_own_instagram
  ON public.instagram_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- whatsapp_accounts
DROP POLICY IF EXISTS users_insert_own_whatsapp ON public.whatsapp_accounts;
CREATE POLICY users_insert_own_whatsapp
  ON public.whatsapp_accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- knowledge_base
DROP POLICY IF EXISTS users_insert_own_knowledge_base ON public.knowledge_base;
CREATE POLICY users_insert_own_knowledge_base
  ON public.knowledge_base FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ai_settings
DROP POLICY IF EXISTS users_insert_own_ai_settings ON public.ai_settings;
CREATE POLICY users_insert_own_ai_settings
  ON public.ai_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

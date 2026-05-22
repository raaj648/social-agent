-- 027_admin_webhook_settings.sql
-- Add webhook verify token and app URL to platform_settings
-- so they can be configured from the admin panel instead of env vars.

INSERT INTO public.platform_settings (key, value) VALUES
  ('meta_webhook_verify_token', '"social-reply-ai-webhook-verify-2026"'::jsonb),
  ('app_url', '"https://social-agent-iota.vercel.app"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 026_admin_stats_refresh_interval.sql
-- Add configurable auto-refresh interval for the admin stats dashboard.
-- Stored in platform_settings with key 'admin_stats_refresh_interval'.
-- Default value: 30 (seconds). Admin can change this in Admin > Settings.

INSERT INTO public.platform_settings (key, value)
VALUES ('admin_stats_refresh_interval', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

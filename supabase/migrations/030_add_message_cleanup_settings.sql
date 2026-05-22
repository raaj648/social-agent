insert into public.platform_settings (key, value) values
  ('message_retention_days', '3'::jsonb),
  ('cleanup_cron_interval', '60'::jsonb)
on conflict (key) do nothing;

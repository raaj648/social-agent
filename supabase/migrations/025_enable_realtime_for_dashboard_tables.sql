-- 025_enable_realtime_for_dashboard_tables.sql
-- Add all dashboard tables to the supabase_realtime publication
-- so the real-time dashboard hook can subscribe to live changes.

alter publication supabase_realtime add table users;
alter publication supabase_realtime add table connected_pages;
alter publication supabase_realtime add table instagram_accounts;
alter publication supabase_realtime add table whatsapp_accounts;

-- Enable Realtime for conversations and messages tables
-- Required for live updates on the dashboard and conversations page

alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;

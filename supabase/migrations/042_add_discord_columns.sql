ALTER TABLE discord_bots
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS command_name TEXT;

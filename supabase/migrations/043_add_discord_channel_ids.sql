ALTER TABLE discord_bots ADD COLUMN IF NOT EXISTS channel_ids JSONB DEFAULT '[]'::jsonb;

UPDATE discord_bots SET channel_ids = jsonb_build_array(channel_id) WHERE channel_id IS NOT NULL AND channel_ids = '[]'::jsonb;

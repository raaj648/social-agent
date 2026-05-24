-- Add per-provider reasoning override for media-containing messages
alter table ai_providers add column reasoning_media_max_tokens integer default null;

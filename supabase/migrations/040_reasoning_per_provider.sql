-- Add per-provider reasoning strategy (for DeepSeek thinking levels)
alter table ai_providers add column reasoning_strategy text default null;

-- Add global reasoning master switch (replaces reasoning_max_tokens as the global ON/OFF)
alter table platform_settings add column reasoning_enabled boolean default true;

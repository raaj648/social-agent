-- Add provider_type and reasoning_max_tokens to ai_providers for multi-provider reasoning control
alter table public.ai_providers
add column provider_type text not null default 'generic'
  check (provider_type in ('openrouter', 'deepseek', 'generic'));

alter table public.ai_providers
add column reasoning_max_tokens integer;

-- Auto-detect existing providers based on base_url
update public.ai_providers
set provider_type = case
  when base_url like '%openrouter.ai%' then 'openrouter'
  when base_url like '%deepseek%' then 'deepseek'
  else 'generic'
end
where provider_type = 'generic';

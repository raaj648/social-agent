alter table public.model_pricing
add column pricing_unit text not null default 'per_1m_tokens'
check (pricing_unit in ('per_1m_tokens', 'per_hour'));

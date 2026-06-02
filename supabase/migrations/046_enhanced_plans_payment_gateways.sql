-- 046_enhanced_plans_payment_gateways.sql
-- Add allowed_actions to billing_plans, payment gateway management RPC

-- 1. Add allowed_actions column to billing_plans
alter table public.billing_plans
add column if not exists allowed_actions jsonb not null default '["text_reply", "image_read", "voice_read"]'::jsonb
  check (allowed_actions <@ '["text_reply", "image_read", "voice_read"]'::jsonb);

-- 2. Seed existing plans with all actions
update public.billing_plans
set allowed_actions = '["text_reply", "image_read", "voice_read"]'::jsonb
where allowed_actions is null;

-- 3. Profit estimate view (read-only, uses last 30d avg)
create or replace view public.profit_estimates as
with avg_usage as (
  select
    coalesce(avg(u.total_cost), 0) as avg_cost_per_user,
    coalesce(avg(u.points_charged), 0) as avg_points_per_user,
    coalesce(count(distinct u.user_id), 0) as active_users
  from (
    select user_id, sum(total_cost) as total_cost, sum(points_charged) as points_charged
    from public.usage_logs
    where created_at >= now() - interval '30 days'
    group by user_id
  ) u
)
select
  bp.id as plan_id,
  bp.name as plan_name,
  bp.price_monthly_cents / 100.0 as price_monthly,
  au.avg_cost_per_user,
  au.avg_points_per_user,
  au.active_users,
  case
    when bp.price_monthly_cents > 0
    then round(((bp.price_monthly_cents / 100.0) - au.avg_cost_per_user) / (bp.price_monthly_cents / 100.0) * 100, 1)
    else 0
  end as profit_margin_pct,
  round((bp.price_monthly_cents / 100.0) - au.avg_cost_per_user, 4) as estimated_profit
from public.billing_plans bp
cross join avg_usage au;

-- 4. RPC to refresh payment gateways list
create or replace function public.get_payment_gateways()
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'slug', g.slug,
      'is_active', g.is_active,
      'config', g.config,
      'sort_order', g.sort_order,
      'created_at', g.created_at,
      'updated_at', g.updated_at
    ) order by g.sort_order, g.created_at
  ) into result
  from public.payment_gateways g;
  return coalesce(result, '[]'::jsonb);
end;
$$;

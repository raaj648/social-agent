-- 045_points_system.sql
-- User subscriptions, variable point deduction, payment gateways

-- 1. user_subscriptions table
create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_id uuid not null references public.billing_plans(id),
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'expired', 'past_due')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  points_allocated integer not null default 0,
  points_used integer not null default 0,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_user on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status);

alter table public.user_subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.user_subscriptions for select
  using (user_id = auth.uid() OR public.is_admin());

create policy "Admins can manage subscriptions"
  on public.user_subscriptions for all
  using (public.is_admin());

-- 2. deduct_points function (variable amount, replaces deduct_credit)
create or replace function public.deduct_points(
  p_user_id uuid,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
as $$
declare
  current_points integer;
begin
  select credits_remaining into current_points
  from public.users
  where id = p_user_id
  for update;

  if current_points is null or current_points < p_amount then
    return false;
  end if;

  update public.users
  set credits_remaining = credits_remaining - p_amount,
      updated_at = now()
  where id = p_user_id;

  return true;
end;
$$;

-- 3. Backward-compatible wrapper (deduct_credit now calls deduct_points)
create or replace function public.deduct_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
begin
  return public.deduct_points(p_user_id, 1);
end;
$$;

-- 4. payment_gateways table (config only, no processing yet)
create table if not exists public.payment_gateways (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_gateways enable row level security;

create policy "Admins can manage payment_gateways"
  on public.payment_gateways for all
  using (public.is_admin());

-- 5. Default point costs (if not already set)
INSERT INTO public.platform_settings (key, value) VALUES
  ('point_cost_text_reply', 1),
  ('point_cost_image_read', 3),
  ('point_cost_voice_read', 2)
ON CONFLICT (key) DO NOTHING;

-- 6. Trigger: auto-allocate points when a subscription is created
create or replace function public.allocate_subscription_points()
returns trigger
language plpgsql
security definer
as $$
declare
  plan_quota integer;
begin
  select daily_quota into plan_quota
  from public.billing_plans
  where id = new.plan_id;

  if plan_quota is not null and plan_quota > 0 then
    update public.users
    set credits_total = credits_total + plan_quota,
        credits_remaining = credits_remaining + plan_quota,
        updated_at = now()
    where id = new.user_id;

    new.points_allocated = plan_quota;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_allocate_subscription_points on public.user_subscriptions;
create trigger trg_allocate_subscription_points
  before insert on public.user_subscriptions
  for each row execute function public.allocate_subscription_points();

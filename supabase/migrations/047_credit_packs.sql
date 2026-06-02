-- 047_credit_packs.sql
-- Prepaid credit packs, purchase tracking, fix subscription quota bug

-- 1. credit_packs table
create table if not exists public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  credits_amount integer not null check (credits_amount > 0),
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  is_auto_renew boolean not null default false,
  sort_order integer not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credit_packs enable row level security;

create policy "Anyone can view active credit packs"
  on public.credit_packs for select
  using (is_active = true OR public.is_admin());

create policy "Admins can manage credit packs"
  on public.credit_packs for all
  using (public.is_admin());

-- 2. credit_purchases table
create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pack_id uuid references public.credit_packs(id),
  credits_allocated integer not null check (credits_allocated > 0),
  amount_paid_cents integer not null check (amount_paid_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'refunded')),
  payment_method text,
  reference_id text,
  admin_note text,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credit_purchases enable row level security;

create policy "Users can view own purchases"
  on public.credit_purchases for select
  using (user_id = auth.uid() OR public.is_admin());

create policy "Users can create purchase requests"
  on public.credit_purchases for insert
  with check (user_id = auth.uid());

create policy "Admins can manage purchases"
  on public.credit_purchases for all
  using (public.is_admin());

-- 3. Default credit packs
INSERT INTO public.credit_packs (name, slug, credits_amount, price_cents, is_auto_renew, sort_order, description) VALUES
  ('Starter Pack', 'starter', 100, 500, false, 10, '100 credits — perfect for getting started'),
  ('Popular Pack', 'popular', 500, 2000, false, 20, '500 credits at a discount — best value for small businesses'),
  ('Pro Pack', 'pro', 2000, 7000, false, 30, '2000 credits for power users — lowest price per credit'),
  ('Monthly Auto Pack', 'auto-monthly', 500, 1500, true, 40, '500 credits every month — auto-renews, credits roll over')
ON CONFLICT (slug) DO NOTHING;

-- 4. Fix daily_quota → monthly_quota in allocate_subscription_points trigger
create or replace function public.allocate_subscription_points()
returns trigger
language plpgsql
security definer
as $$
declare
  plan_quota integer;
begin
  select monthly_quota into plan_quota
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

-- 5. Function to update subscription points_used after deduction
create or replace function public.update_subscription_points_used(
  p_user_id uuid,
  p_amount integer
)
returns void
language plpgsql
security definer
as $$
begin
  update public.user_subscriptions
  set points_used = points_used + p_amount,
      updated_at = now()
  where user_id = p_user_id
    and status = 'active'
  order by start_date desc
  limit 1;
end;
$$;

-- 6. Function to approve a credit purchase and credit the user
create or replace function public.approve_credit_purchase(
  p_purchase_id uuid,
  p_admin_id uuid,
  p_admin_note text default null
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_credits integer;
  v_status text;
begin
  select user_id, credits_allocated, status into v_user_id, v_credits, v_status
  from public.credit_purchases
  where id = p_purchase_id
  for update;

  if v_status != 'pending' then
    return false;
  end if;

  update public.credit_purchases
  set status = 'approved',
      approved_by = p_admin_id,
      approved_at = now(),
      admin_note = coalesce(p_admin_note, admin_note),
      updated_at = now()
  where id = p_purchase_id;

  update public.users
  set credits_total = credits_total + v_credits,
      credits_remaining = credits_remaining + v_credits,
      updated_at = now()
  where id = v_user_id;

  return true;
end;
$$;

-- 7. Indexes
create index if not exists idx_credit_purchases_user on public.credit_purchases(user_id);
create index if not exists idx_credit_purchases_status on public.credit_purchases(status);
create index if not exists idx_credit_packs_slug on public.credit_packs(slug);

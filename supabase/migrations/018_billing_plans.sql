-- Create billing_plans table for editable plan pricing

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_monthly_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  daily_quota integer NOT NULL DEFAULT 100,
  max_pages integer NOT NULL DEFAULT 1,
  allowed_models text[] DEFAULT '{}',
  features jsonb DEFAULT '[]'::jsonb,
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON public.billing_plans FOR SELECT
  USING (is_active OR public.is_admin());

CREATE POLICY "Admins can insert billing_plans"
  ON public.billing_plans FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update billing_plans"
  ON public.billing_plans FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete billing_plans"
  ON public.billing_plans FOR DELETE
  USING (public.is_admin());

-- Seed default plans
INSERT INTO public.billing_plans (slug, name, description, price_monthly_cents, daily_quota, max_pages, allowed_models, features, is_popular, sort_order) VALUES
  ('free', 'Free', 'Perfect for testing the waters', 0, 100, 1, '{openai/gpt-3.5-turbo}', '["1 Facebook Page", "100 AI replies/day", "Basic knowledge base", "Email support"]'::jsonb, false, 1),
  ('starter', 'Starter', 'For growing businesses', 1900, 500, 3, '{openai/gpt-3.5-turbo,anthropic/claude-3-haiku}', '["3 Facebook Pages", "500 AI replies/day", "Instagram DM support", "Full knowledge base", "Priority email support"]'::jsonb, true, 2),
  ('pro', 'Pro', 'For serious automation', 4900, 2000, 10, '{*}', '["10 Facebook Pages", "2,000 AI replies/day", "Instagram + Messenger", "Advanced analytics", "Custom AI model", "Priority chat support"]'::jsonb, false, 3),
  ('enterprise', 'Enterprise', 'For agencies & large teams', 14900, 10000, 999, '{*}', '["Unlimited pages", "10,000 AI replies/day", "All platforms", "Custom branding", "Dedicated support", "SLA guarantee", "API access"]'::jsonb, false, 4)
ON CONFLICT (slug) DO NOTHING;

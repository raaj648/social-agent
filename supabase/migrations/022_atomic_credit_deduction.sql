-- 022_atomic_credit_deduction.sql
-- Replace separate checkCredits + increment_usage with atomic deduct_credit
-- that uses SELECT FOR UPDATE to prevent race conditions on concurrent webhooks.

-- 1. Create atomic deduct_credit function
-- Returns true if credit was deducted, false if insufficient credits
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits integer;
BEGIN
  SELECT credits_remaining INTO current_credits
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET credits_remaining = credits_remaining - 1,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

-- 2. Keep increment_usage for backward compatibility (used in playground, etc.)
-- but have it use deduct_credit internally to ensure consistency
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id uuid, p_tokens integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deducted boolean;
BEGIN
  deducted := public.deduct_credit(p_user_id);

  IF NOT deducted THEN
    RAISE WARNING 'increment_usage: No credit deducted for user % — insufficient credits or user missing', p_user_id;
  END IF;
END;
$$;

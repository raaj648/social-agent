import { createAdminClient } from './supabase/admin';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 30,
};

export async function checkRateLimit(
  userId: string,
  action: string,
  config: RateLimitConfig = defaultConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const supabase = await createAdminClient();
  const windowStart = new Date(Date.now() - config.windowMs);

  const { count, error } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart.toISOString());

  if (error) throw error;

  const remaining = Math.max(0, config.maxRequests - (count || 0));
  const resetAt = new Date(Date.now() + config.windowMs);

  return {
    allowed: (count || 0) < config.maxRequests,
    remaining,
    resetAt,
  };
}

export async function checkCredits(
  userId: string
): Promise<{ allowed: boolean; remaining: number; total: number; expiresAt: string | null }> {
  const supabase = await createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('credits_remaining, credits_total, credits_expires_at')
    .eq('id', userId)
    .single();

  if (error || !user) throw error;

  const expired = user.credits_expires_at && new Date(user.credits_expires_at) < new Date();

  return {
    allowed: user.credits_remaining > 0 && !expired,
    remaining: user.credits_remaining,
    total: user.credits_total,
    expiresAt: user.credits_expires_at,
  };
}


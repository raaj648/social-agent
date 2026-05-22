-- Rename daily_quota to monthly_quota to reflect monthly billing model
ALTER TABLE public.billing_plans RENAME COLUMN daily_quota TO monthly_quota;

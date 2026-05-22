-- Add auto-incrementing numeric user ID, remove username
CREATE SEQUENCE IF NOT EXISTS public.user_number_seq START 100000;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_number bigint;

UPDATE public.users SET user_number = nextval('public.user_number_seq') WHERE user_number IS NULL;

ALTER TABLE public.users ALTER COLUMN user_number SET NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_user_number_unique UNIQUE (user_number);

DROP INDEX IF EXISTS public.idx_users_username;
ALTER TABLE public.users DROP COLUMN IF EXISTS username;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, user_number)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    nextval('public.user_number_seq')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

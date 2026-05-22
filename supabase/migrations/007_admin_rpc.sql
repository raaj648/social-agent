-- RPC function to check if current user is admin (bypasses RLS via SECURITY DEFINER)
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
    and role = 'admin'
  );
$$;

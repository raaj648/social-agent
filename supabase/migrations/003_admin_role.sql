-- Add role column to users table
alter table public.users
  add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- Only admins can see all users
drop policy if exists "Users can read own data" on public.users;
create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ));

-- Allow admins to update any user
create policy "Admins can update users"
  on public.users for update
  using (exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ));

-- Admin view for all tenants
create policy "Admins can read all tenants"
  on public.tenants for select
  using (owner_id = auth.uid() or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ));

create policy "Admins can update tenants"
  on public.tenants for update
  using (exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ));

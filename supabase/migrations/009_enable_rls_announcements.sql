-- Enable RLS on announcement tables (missing from migration 006)
alter table public.announcement_templates enable row level security;
alter table public.announcements enable row level security;

-- Admin-only policies for announcement_templates
create policy "Admins can read announcement_templates"
  on public.announcement_templates for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can insert announcement_templates"
  on public.announcement_templates for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can update announcement_templates"
  on public.announcement_templates for update
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can delete announcement_templates"
  on public.announcement_templates for delete
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Admin-only policies for announcements
create policy "Admins can read announcements"
  on public.announcements for select
  using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

create policy "Admins can insert announcements"
  on public.announcements for insert
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

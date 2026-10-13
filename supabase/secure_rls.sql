-- ============================================================
-- STAGE 2: Lock down the assessments table with Row Level Security
-- ============================================================
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- PREREQUISITE: run scripts/import-users.mjs FIRST so that every staff
-- member and manager has a real Supabase Auth account. Until then this
-- policy set will block the web app (expected - schedule a short window).
--
-- How it works after migration:
--   * Users sign in with their email + password (real Supabase sessions)
--   * Staff can only read/update rows where they are the employee
--   * Managers can only read/update rows where they are the manager
--   * admin@metabev.com can read/update/delete everything
--   * Anonymous (unauthenticated) requests can do NOTHING - the current
--     public read/write hole is closed.

alter table public.assessments enable row level security;

-- Helper: the signed-in user's email, lowercased
create or replace function public.auth_email()
returns text
language sql
stable
as $$
  select nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
$$;

-- Helper: true if the caller is the app administrator
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.auth_email() = 'admin@metabev.com';
$$;

-- Staff see their own reviews, managers see reviews they own, admin sees all
create policy "select own or managed or admin"
on public.assessments
for select
using (
  lower(email) = public.auth_email()
  or lower(manager_email) = public.auth_email()
  or public.is_admin()
);

-- Allow the app to create rows for its own users (bulk CSV upload runs as admin)
create policy "insert own or managed or admin"
on public.assessments
for insert
with check (
  lower(email) = public.auth_email()
  or lower(manager_email) = public.auth_email()
  or public.is_admin()
);

-- Managers update their staff's records; staff update their own drafts
create policy "update own or managed or admin"
on public.assessments
for update
using (
  lower(email) = public.auth_email()
  or lower(manager_email) = public.auth_email()
  or public.is_admin()
)
with check (
  lower(email) = public.auth_email()
  or lower(manager_email) = public.auth_email()
  or public.is_admin()
);

-- Only the administrator may delete records
create policy "delete admin only"
on public.assessments
for delete
using (public.is_admin());

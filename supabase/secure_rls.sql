-- ============================================================
-- STAGE 2: Lock down the assessments table with Row Level Security
-- ============================================================
-- IDEMPOTENT VERSION - safe to run multiple times (drops and
-- recreates the policies, then enables RLS). No "already exists"
-- errors even if a previous run half-applied.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- PREREQUISITE: supabase/import-users.mjs must have created the Auth
-- accounts first, otherwise no one can read their rows.
--
-- How it works after migration:
--   * Users sign in with email + password (real Supabase sessions)
--   * Staff can only read/update rows where they are the employee
--   * Managers can only read/update rows where they are the manager
--   * admin@metabev.com can read/update/delete everything
--   * Anonymous (unauthenticated) requests can do NOTHING - the old
--     public read/write hole is closed.

-- 1) Helper functions (re-created fresh each run)
create or replace function public.auth_email()
returns text
language sql
stable
as $$
  select nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.auth_email() = 'admin@metabev.com';
$$;

-- 2) Remove any previously created versions of the policies
drop policy if exists "select own or managed or admin" on public.assessments;
drop policy if exists "insert own or managed or admin" on public.assessments;
drop policy if exists "update own or managed or admin" on public.assessments;
drop policy if exists "delete admin only" on public.assessments;

-- 3) Recreate the policies
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

-- 4) Switch RLS on (this is the statement that actually closes the hole)
alter table public.assessments enable row level security;

-- 5) Proof for you: the result must show rls_enabled = true
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'assessments') as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'assessments';

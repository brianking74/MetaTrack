-- ============================================================
-- Expense Dashboard - let SELECTED managers see company-wide
-- expense claim totals (with staff / type / status filters).
--
-- Run this in the Supabase SQL Editor. Run it BEFORE (or at the
-- same time as) deploying the app code that adds the manager
-- "Dashboard" tab - a manager who is a viewer will otherwise see
-- a "not set up yet" notice.
--
-- Access model:
--   * expense_dashboard_viewers  = allowlist of manager emails
--   * is_expense_dashboard_viewer() = SECURITY DEFINER check
--     (the allowlist itself never leaks to clients)
--   * a new permissive SELECT policy on expense_claims lets
--     viewers (and admins) read ALL claims; everyone else keeps
--     the existing own / managed-only visibility
-- ============================================================

-- 1) Allowlist table (empty by default - seed in step 4)
create table if not exists public.expense_dashboard_viewers (
  email    text primary key,
  added_at timestamptz not null default now()
);

alter table public.expense_dashboard_viewers enable row level security;

-- No SELECT policy on purpose: the table is only readable through
-- the SECURITY DEFINER function below.

-- 2) Checker function (definer = no RLS recursion, fast)
create or replace function public.is_expense_dashboard_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.expense_dashboard_viewers v
    where lower(v.email) = public.auth_email()
  );
$$;

-- 3) Extra SELECT policy on expense_claims. Postgres ORs permissive
--    policies together, so the existing "own or managed or admin"
--    visibility is untouched.
drop policy if exists "expenses select for dashboard viewers" on public.expense_claims;
create policy "expenses select for dashboard viewers"
on public.expense_claims
for select
using (
  public.is_expense_dashboard_viewer()
  or public.is_admin()
);

-- 4) Seed the selected managers - EDIT THIS LIST BEFORE RUNNING
insert into public.expense_dashboard_viewers (email)
values ('molly@metabev.com')
on conflict (email) do nothing;

-- Add more viewers any time:
--   insert into public.expense_dashboard_viewers (email)
--   values ('manager2@metabev.com') on conflict (email) do nothing;
-- Remove one:
--   delete from public.expense_dashboard_viewers where email = 'x@metabev.com';

-- ============================================================
-- 5) Verification - expect: viewers | 1  and  policy installed | 1
-- ============================================================
select 'viewers seeded' as check, count(*)::text as result
from public.expense_dashboard_viewers
union all
select 'policy installed', count(*)::text
from pg_policies
where schemaname = 'public'
  and tablename = 'expense_claims'
  and policyname = 'expenses select for dashboard viewers';

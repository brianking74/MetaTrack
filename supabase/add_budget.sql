-- ============================================================
-- add_budget.sql - GM-controlled annual budget for the Expense Dashboard
-- ============================================================
-- Adds public.expense_budget: one row per year holding the total budget
-- the General Manager enters in the dashboard ("Budget" panel).
--
--   budget_year : the calendar year the budget applies to (PK)
--   amount      : total budget available for that year, in HKD
--   updated_by  : email of the GM who last saved it
--   updated_at  : when it was last saved
--
-- RLS: READ is limited to the dashboard allowlist - the same
-- expense_dashboard_viewers gate that controls who can open the
-- Expense Dashboard at all (currently just the GM; line managers
-- can be added to the allowlist later) - plus the service admin.
-- Anyone who cannot open the dashboard cannot read the budget via
-- the API either. Only the General Manager may WRITE.
-- The GM address is hardcoded below - keep it in sync with
-- EXPENSE_GM_EMAIL in constants.ts (same approach as is_admin() in
-- secure_rls.sql hardcodes admin@metabev.com).
--
-- v3: fixes a syntax bug present since v1 - both "create policy"
-- statements were missing the required "on public.expense_budget"
-- clause, so the script failed with
--   ERROR 42601 syntax error at or near "for"
-- and rolled back (nothing was created). Run this file as-is.
--
-- v2: tightens the read policy. The first version let every
-- authenticated user read the budget; this file drops that broad
-- policy and keeps any saved budget rows.
--
-- IDEMPOTENT: safe to run more than once. Re-running never deletes the
-- saved budget rows.
-- ============================================================

create table if not exists public.expense_budget (
  budget_year int primary key check (budget_year between 2000 and 2100),
  amount      numeric(14, 2) not null check (amount >= 0),
  updated_by  text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.expense_budget enable row level security;

-- READ: dashboard allowlist members + service admin only - the same
-- check the expense_claims "expenses select for dashboard viewers"
-- policy in add_dashboard.sql uses. The GM is on the allowlist, so
-- the GM can read through this policy too.
drop policy if exists "authenticated can read budget" on public.expense_budget;
drop policy if exists "dashboard viewers can read budget" on public.expense_budget;
create policy "dashboard viewers can read budget"
  on public.expense_budget
  for select
  to authenticated
  using (
    public.is_expense_dashboard_viewer()
    or public.is_admin()
  );

-- Only the General Manager can set or change the budget.
drop policy if exists "gm manages budget" on public.expense_budget;
create policy "gm manages budget"
  on public.expense_budget
  for all
  to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'sophian@meta-bev.com'
  )
  with check (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'sophian@meta-bev.com'
  );

-- ============================================================
-- Verification (run these after the script; SQL Editor bypasses RLS,
-- so policy enforcement is verified in the app, not here)
-- ============================================================

-- A) Table exists with the right columns -> expect 4 rows
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'expense_budget'
-- order by ordinal_position;

-- B) RLS is enabled -> expect true
-- select relrowsecurity from pg_class
-- where relnamespace = 'public'::regnamespace and relname = 'expense_budget';

-- C) Both policies exist -> expect 2 rows:
--    "dashboard viewers can read budget" (SELECT) + "gm manages budget" (ALL)
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'expense_budget';

-- C2) The old broad policy from v1 is gone -> expect 0
-- select count(*) from pg_policies
-- where schemaname = 'public' and tablename = 'expense_budget'
--   and policyname = 'authenticated can read budget';

-- D) Current contents (empty until the GM saves a budget for the first time)
-- select * from public.expense_budget order by budget_year;

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
-- RLS: every authenticated user may READ (the whole team sees the
-- spend-vs-budget running total); only the General Manager may WRITE.
-- The GM address is hardcoded below - keep it in sync with
-- EXPENSE_GM_EMAIL in constants.ts (same approach as is_admin() in
-- secure_rls.sql hardcodes admin@metabev.com).
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

-- Every signed-in user can read the budget (dashboard shows the running
-- total to managers; only the figure is exposed, nothing sensitive).
drop policy if exists "authenticated can read budget" on public.expense_budget;
create policy "authenticated can read budget"
  for select
  to authenticated
  using (true);

-- Only the General Manager can set or change the budget.
drop policy if exists "gm manages budget" on public.expense_budget;
create policy "gm manages budget"
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

-- C) Both policies exist -> expect 2 rows (read + gm manages)
-- select policyname, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'expense_budget';

-- D) Current contents (empty until the GM saves a budget for the first time)
-- select * from public.expense_budget order by budget_year;

-- ============================================================
-- EXPENSE CLAIM FIELDS: customer, budget code, currency + FX
-- ============================================================
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Run this BEFORE deploying the app update that uses these fields.
-- IDEMPOTENT: safe to run multiple times, does not touch existing rows'
-- other values or any policies.
--
-- Background (from the company's paper Travel/Expense Report):
--   - Customer Name      : which client the expense was for
--   - Brand Budget code  : cost-allocation code (e.g. EST008)
--   - Currency + FX rate : one currency per line; fx_rate is "HKD per
--     1 unit of the foreign currency" (the paper form's definition).
--     amount_hkd = amount * fx_rate is the HKD reporting value every
--     total in the portal (dashboard, analytics, emails) sums.
--
-- Existing rows were all submitted in HKD (the old form was HKD-only),
-- so the backfill sets fx_rate = 1 and amount_hkd = amount for them.
-- No RLS changes are needed: row policies apply to the new columns
-- automatically.

-- 1) Add the new nullable columns
alter table public.expense_claims
  add column if not exists customer_name text;
alter table public.expense_claims
  add column if not exists budget_code text;
alter table public.expense_claims
  add column if not exists fx_rate numeric(14, 6);
alter table public.expense_claims
  add column if not exists amount_hkd numeric(14, 2);

-- 2) Backfill existing rows (all pre-existing claims are HKD)
update public.expense_claims
  set fx_rate = 1
  where fx_rate is null;

update public.expense_claims
  set amount_hkd = amount
  where amount_hkd is null;

-- 3) Document the columns
comment on column public.expense_claims.customer_name is 'Optional customer/client the expense relates to (from the paper expense report)';
comment on column public.expense_claims.budget_code is 'Optional brand budget / cost-allocation code, e.g. EST008';
comment on column public.expense_claims.fx_rate is 'HKD per 1 unit of the claim currency (1 for HKD claims)';
comment on column public.expense_claims.amount_hkd is 'Reporting amount in HKD = amount * fx_rate, rounded to 2dp';

-- ------------------------------------------------------------
-- Verification - must return exactly 4 rows:
--   amount_hkd | numeric | budget_code | text
--   budget_code | text | customer_name | text | fx_rate | numeric
-- (one row per new column)
-- ------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'expense_claims'
  and column_name in ('customer_name', 'budget_code', 'fx_rate', 'amount_hkd')
order by column_name;

-- Verification 2 - every row must now have both values (count = 0):
select count(*) as rows_missing_hkd
from public.expense_claims
where fx_rate is null or amount_hkd is null;

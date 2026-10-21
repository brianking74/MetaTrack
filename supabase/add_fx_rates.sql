-- ============================================================
-- COMPANY FX RATES: admin-controlled exchange rates for claims
-- ============================================================
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Run this BEFORE deploying the app update that uses these rates.
-- IDEMPOTENT: safe to run multiple times (never overwrites a rate the
-- administrator has already set).
--
-- What it does
--   1) Creates public.expense_fx_rates: ONE row per currency, where rate
--      means "HKD per 1 unit of the currency" - the same definition the
--      claim form has always used (e.g. USD 7.848246 = 1 USD -> HK$7.85).
--   2) Locks it down with Row Level Security:
--        - every signed-in user can READ (the claim form needs the rates)
--        - only the administrator (public.is_admin(), i.e. admin@metabev.com)
--          can INSERT / UPDATE / DELETE
--      Staff can no longer set or change the exchange rate they claim at;
--      the Admin Hub (FX Rates tab) is the single source of truth.
--   3) Seeds all 12 claim currencies with reference rates from
--      open.er-api.com (21 Oct 2026), marked updated_by = 'seed' so the
--      Admin Hub shows them as "company default - please review".
--
-- Notes
--   - Existing claims are NOT touched: every claim keeps the rate that was
--     frozen into it at submission (fx_rate + amount_hkd columns).
--   - To change the admin identity later, see public.is_admin() in
--     secure_rls.sql - this script intentionally reuses it.

-- ------------------------------------------------------------
-- 1) Table
-- ------------------------------------------------------------
create table if not exists public.expense_fx_rates (
  currency   text primary key,
  rate       numeric(14,6) not null check (rate > 0),
  updated_by text,
  updated_at timestamptz not null default now()
);

comment on table public.expense_fx_rates is
  'Company exchange rates for expense claims: one row per currency, rate = HKD per 1 unit. Written only by the administrator, read by all signed-in users. Claims freeze the rate at submission, so later changes never rewrite history.';
comment on column public.expense_fx_rates.rate is 'HKD per 1 unit of the currency (1 for HKD)';
comment on column public.expense_fx_rates.updated_by is 'admin email who set the rate, or "seed" for the setup-script defaults';
comment on column public.expense_fx_rates.updated_at is 'when the rate was last saved';

-- ------------------------------------------------------------
-- 2) Row Level Security: ON
-- ------------------------------------------------------------
alter table public.expense_fx_rates enable row level security;

-- ------------------------------------------------------------
-- 3) Policies (wipe + recreate = idempotent)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'expense_fx_rates'
  loop
    raise notice 'dropping policy: %', r.policyname;
    execute format('drop policy if exists %I on public.expense_fx_rates', r.policyname);
  end loop;
end $$;

-- every signed-in user reads the rates (the claim form displays them)
create policy "fx rates read authenticated"
on public.expense_fx_rates
for select
to authenticated
using (true);

-- only the administrator may add / change / remove rates
create policy "fx rates insert admin only"
on public.expense_fx_rates
for insert
to authenticated
with check (public.is_admin());

create policy "fx rates update admin only"
on public.expense_fx_rates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "fx rates delete admin only"
on public.expense_fx_rates
for delete
to authenticated
using (public.is_admin());

-- ------------------------------------------------------------
-- 4) Seed the 12 claim currencies (open.er-api.com reference rates,
--    21 Oct 2026). on conflict do nothing: re-running NEVER clobbers a
--    rate the administrator has set. HKD is the base currency, rate = 1.
-- ------------------------------------------------------------
insert into public.expense_fx_rates (currency, rate, updated_by, updated_at) values
  ('HKD', 1.000000,  'seed', now()),
  ('CNY', 1.172868,  'seed', now()),
  ('MOP', 0.970874,  'seed', now()),
  ('TWD', 0.240719,  'seed', now()),
  ('JPY', 0.049612,  'seed', now()),
  ('KRW', 0.005910,  'seed', now()),
  ('SGD', 6.140281,  'seed', now()),
  ('THB', 0.233449,  'seed', now()),
  ('AUD', 5.490765,  'seed', now()),
  ('USD', 7.848246,  'seed', now()),
  ('EUR', 8.811582,  'seed', now()),
  ('GBP', 10.492409, 'seed', now())
on conflict (currency) do nothing;

-- ------------------------------------------------------------
-- 5) Verification - paste the results back for confirmation
-- ------------------------------------------------------------
-- Query A: must show rls_enabled = true and policy_count = 4
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'expense_fx_rates') as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'expense_fx_rates';

-- Query B: must list EXACTLY these four policies
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'expense_fx_rates'
order by policyname;

-- Query C: must list 12 currencies, all with positive rates
select currency, rate, updated_by, to_char(updated_at, 'YYYY-MM-DD HH24:MI') as updated
from public.expense_fx_rates
order by currency;

-- Query D: must return 0 (every claim currency has a rate)
select count(*) as currencies_missing
from unnest(array['HKD','CNY','MOP','TWD','JPY','KRW','SGD','THB','AUD','USD','EUR','GBP']) as c(code)
where not exists (
  select 1 from public.expense_fx_rates r where r.currency = c.code
);

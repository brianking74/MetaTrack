-- ============================================================
-- EXPENSE CLAIMS: GENERAL MANAGER (SECOND) APPROVAL STAGE
-- ============================================================
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Run this BEFORE deploying the app update that adds the GM stage.
-- IDEMPOTENT: safe to run multiple times.
--
-- Workflow this enables (matches the app):
--   submitted  -> line manager reviews
--   pending_gm -> approved by the line manager, waiting for the GM
--                 (GM: sophian@meta-bev.com by default)
--   approved   -> GM gave final approval; staff are told claims are paid
--                 within 30 days and finance is notified to pay
--   rejected   -> not approved (line manager OR GM); staff resubmit
--
-- What this script does:
--   1) adds gm_email / gm_comment / manager_reviewed_by / manager_reviewed_at
--   2) backfills gm_email for existing rows (all go to the current GM)
--   3) widens the status CHECK constraint to allow 'pending_gm'
--   4) rewrites the RLS policies so the GM can see + review claims
--      stamped with their email, and open the receipts
--   5) indexes the GM queue
--
-- The GM address lives in TWO places - keep them in sync if it changes:
--   app : constants.ts  ->  EXPENSE_GM_EMAIL
--   db  : this script's GM_EMAIL variable below

-- ------------------------------------------------------------
-- 0) Current GM email (change here if the role moves to someone else)
-- ------------------------------------------------------------
\set GM_EMAIL 'sophian@meta-bev.com'

-- psql variables (\set) are NOT supported by the Supabase SQL Editor,
-- so the address is also inlined in the statements below. If you change
-- the GM, replace every literal 'sophian@meta-bev.com' in this file.

-- ------------------------------------------------------------
-- 1) New columns
-- ------------------------------------------------------------
alter table public.expense_claims
  add column if not exists gm_email text;
alter table public.expense_claims
  add column if not exists gm_comment text;
alter table public.expense_claims
  add column if not exists manager_reviewed_by text;
alter table public.expense_claims
  add column if not exists manager_reviewed_at timestamptz;

-- ------------------------------------------------------------
-- 2) Backfill: every existing claim goes to the current GM
-- ------------------------------------------------------------
update public.expense_claims
  set gm_email = 'sophian@meta-bev.com'
  where gm_email is null;

comment on column public.expense_claims.gm_email is 'General Manager who gives the final (second) approval; stamped at submission time from constants.ts EXPENSE_GM_EMAIL';
comment on column public.expense_claims.gm_comment is 'Comment recorded at the GM (final) review stage';
comment on column public.expense_claims.manager_reviewed_by is 'Line manager who approved the claim (stage-1 audit trail)';
comment on column public.expense_claims.manager_reviewed_at is 'When the line manager approved (stage-1 audit trail)';

-- ------------------------------------------------------------
-- 3) Status CHECK constraint: allow 'pending_gm'
--    (the original constraint came from setup_expenses.sql with only
--    submitted/approved/rejected - it would block the GM workflow)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.expense_claims'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    raise notice 'dropping status check constraint: %', r.conname;
    execute format('alter table public.expense_claims drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.expense_claims
  add constraint expense_claims_status_check
  check (status in ('submitted', 'pending_gm', 'approved', 'rejected'));

-- ------------------------------------------------------------
-- 4) Index for the GM queue
-- ------------------------------------------------------------
create index if not exists expense_claims_gm_idx
  on public.expense_claims (lower(gm_email), status);

-- ------------------------------------------------------------
-- 5) RLS: recreate the table policies with the GM included
--    (drop + recreate = same idempotent technique as setup_expenses.sql)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'expense_claims'
  loop
    raise notice 'dropping policy: %', r.policyname;
    execute format('drop policy if exists %I on public.expense_claims', r.policyname);
  end loop;
end $$;

-- staff read their own claims, managers their team's, the GM the claims
-- awaiting their final approval (plus everything they already decided),
-- admin reads all
create policy "expenses select own or managed or gm or admin"
on public.expense_claims
for select
using (
  lower(email) = public.auth_email()
  or lower(manager_email) = public.auth_email()
  or (gm_email is not null and lower(gm_email) = public.auth_email())
  or public.is_admin()
);

-- only the claimant can submit, and always with status 'submitted'
create policy "expenses insert own"
on public.expense_claims
for insert
with check (
  lower(email) = public.auth_email()
  and status = 'submitted'
);

-- the line manager (or admin) reviews stage 1; the GM reviews claims
-- stamped with their own email (stage 2, final)
create policy "expenses review by manager or gm or admin"
on public.expense_claims
for update
using (
  lower(manager_email) = public.auth_email()
  or (gm_email is not null and lower(gm_email) = public.auth_email())
  or public.is_admin()
)
with check (
  lower(manager_email) = public.auth_email()
  or (gm_email is not null and lower(gm_email) = public.auth_email())
  or public.is_admin()
);

-- only the administrator may delete claims
create policy "expenses delete admin only"
on public.expense_claims
for delete
using (public.is_admin());

-- ------------------------------------------------------------
-- 6) Storage: the GM can open receipts of claims awaiting/decided by them
-- ------------------------------------------------------------
drop policy if exists "receipts read participants" on storage.objects;

create policy "receipts read participants"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'expense-receipts'
  and (
    (storage.foldername(name))[1] = public.auth_email()
    or exists (
      select 1 from public.expense_claims c
      where c.receipt_path = name
        and (
          lower(c.manager_email) = public.auth_email()
          or (c.gm_email is not null and lower(c.gm_email) = public.auth_email())
          or public.is_admin()
        )
    )
  )
);

-- ------------------------------------------------------------
-- 7) Verification - paste the results back for confirmation
-- ------------------------------------------------------------
-- Query A: must show rls_enabled = true and policy_count = 4
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = 'expense_claims') as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'expense_claims';

-- Query B: must list EXACTLY these four policies
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'expense_claims'
order by policyname;

-- Query C: must show the four status values
select pg_get_constraintdef(oid) as status_check
from pg_constraint
where conrelid = 'public.expense_claims'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) like '%status%';

-- Query D: every row must have a GM on file (count = 0)
select count(*) as rows_missing_gm
from public.expense_claims
where gm_email is null;

-- Query E: the four GM columns must exist
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'expense_claims'
  and column_name in ('gm_email', 'gm_comment', 'manager_reviewed_by', 'manager_reviewed_at')
order by column_name;

-- Query F: the storage policy must be back with the GM included
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname = 'receipts read participants';
